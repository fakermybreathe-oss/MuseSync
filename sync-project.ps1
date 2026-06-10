# MuseSync 一键运维与自动部署助手
# 您的海外 VPS IP: 207.57.131.146, 端口: 50520

$vps_ip = "207.57.131.146"
$vps_port = "50520"
$vps_user = "root"

# 清理终端并显示精美标题
Clear-Host
Write-Host "=========================================================" -ForegroundColor Cyan
Write-Host "         MuseSync 核心大脑 一键同步与自动部署工具" -ForegroundColor Cyan
Write-Host "=========================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host " [提示] 调试与测试垃圾文件已被安全移至本地 'scratch/' 目录 (已被 Git 过滤)。" -ForegroundColor Yellow
Write-Host "        现在的提交与拉取 100% 纯净，仅包含项目核心大脑代码。" -ForegroundColor Green
Write-Host ""
Write-Host "---------------------------------------------------------"

function Show-Menu {
    Write-Host "[1] 从 GitHub 拉取远程最新代码 (Pull)" -ForegroundColor White
    Write-Host "[2] 提交并推送本地修改到 GitHub (Push)" -ForegroundColor White
    Write-Host "[3] 一键部署并热重载 VPS 后端服务 (Deploy to VPS)" -ForegroundColor White
    Write-Host "[4] 一键全流程同步：提交推送 + 立即部署到 VPS (All in One)" -ForegroundColor Green
    Write-Host "[5] 退出" -ForegroundColor Red
    Write-Host ""
}

function Perform-Pull {
    Write-Host "⏳ 正在拉取最新的 GitHub 代码..." -ForegroundColor Cyan
    git pull
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ 本地拉取更新成功！" -ForegroundColor Green
    } else {
        Write-Host "❌ 本地拉取失败，请检查网络或 Git 冲突。" -ForegroundColor Red
    }
}

function Perform-Push {
    Write-Host "⏳ 检查本地修改状态..." -ForegroundColor Cyan
    git status
    Write-Host ""
    $msg = Read-Host "请输入本次提交说明 (Commit Message) [默认: update: musesync code update]"
    if ([string]::IsNullOrEmpty($msg)) {
        $msg = "update: musesync code update"
    }
    
    Write-Host "⏳ 正在执行本地暂存与提交..." -ForegroundColor Cyan
    git add .
    git commit -m "$msg"
    
    Write-Host "⏳ 正在推送到 GitHub 远程仓库..." -ForegroundColor Cyan
    git push
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ 核心大脑代码推送成功！Cloudflare Pages 将在数分钟内自动完成前端构建。" -ForegroundColor Green
    } else {
        Write-Host "❌ 推送失败，请检查远程仓库权限或网络。" -ForegroundColor Red
    }
}

function Perform-Deploy {
    Write-Host "⏳ 准备连接海外 VPS 执行一键更新..." -ForegroundColor Cyan
    Write-Host "👉 远程 VPS: $vps_ip:$vps_port" -ForegroundColor Yellow
    Write-Host "💡 连接成功后，会要求您输入 VPS 的 root 密码 (临时密码: 1kMO4MrEvB00)" -ForegroundColor Yellow
    Write-Host ""
    
    # 动态定位工作路径并升级后端的单行 Bash 命令
    $remote_deploy_cmd = @'
clear
echo '========================================================='
echo '  ⚡ MuseSync Remote VPS Project Auto-Update & Deploy ⚡'
echo '========================================================='
echo ''
echo '⏳ [1/4] Detecting PM2 backend work directory...'
TARGET_DIR=$(pm2 describe musesync-backend 2>/dev/null | grep -oP '/[a-zA-Z0-9_\-\./]+apps/server' | head -n 1 | sed 's/\/apps\/server//')
if [ -z "$TARGET_DIR" ]; then
    echo '⚠️ Cannot find directory from PM2. Falling back to default: /root/musesync'
    TARGET_DIR="/root/musesync"
fi
echo "📂 Target Directory: $TARGET_DIR"
cd "$TARGET_DIR" || { echo '❌ Directory not found!'; exit 1; }

echo ''
echo '⏳ [2/4] Pulling latest code from GitHub...'
git pull

echo ''
echo '⏳ [3/4] Installing updated dependencies (if any)...'
pnpm install --frozen-lockfile

echo ''
echo '⏳ [4/4] Building and reloading server process...'
pnpm --filter @musesync/server build
pm2 reload musesync-backend

echo ''
echo '========================================================='
echo '✅ Success! VPS backend successfully updated and reloaded!'
echo '========================================================='
exit
'@

    # 执行 SSH 远程部署
    ssh -o StrictHostKeyChecking=no -p $vps_port "$vps_user@$vps_ip" $remote_deploy_cmd
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "🎉 线上后端更新指令执行成功！" -ForegroundColor Green
    } else {
        Write-Host "❌ 线上部署失败，请检查 SSH 密码或网络连接。" -ForegroundColor Red
    }
}

# 循环菜单逻辑
while ($true) {
    Show-Menu
    $choice = Read-Host "请选择操作序号 [1-5]"
    switch ($choice) {
        "1" {
            Perform-Pull
            Write-Host ""
        }
        "2" {
            Perform-Push
            Write-Host ""
        }
        "3" {
            Perform-Deploy
            Write-Host ""
        }
        "4" {
            Perform-Push
            if ($LASTEXITCODE -eq 0) {
                Write-Host ""
                Perform-Deploy
            }
            Write-Host ""
        }
        "5" {
            Write-Host "👋 感谢使用，再见！" -ForegroundColor Cyan
            break
        }
        Default {
            Write-Host "⚠️ 无效的选择，请输入 1-5 之间的数字。" -ForegroundColor Red
            Write-Host ""
        }
    }
}
