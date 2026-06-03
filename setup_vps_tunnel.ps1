# MuseSync 异地跨国隧道一键拉起脚本
# 您的海外 VPS IP 已绑定为: 207.57.131.146

Clear-Host
Write-Host "=========================================================" -ForegroundColor Cyan
Write-Host "         MuseSync 异地跨国 SSH 反向隧道建立工具" -ForegroundColor Cyan
Write-Host "=========================================================" -ForegroundColor Cyan
Write-Host ""

# 1. 温馨提示配置 GatewayPorts
Write-Host "[提示] 请确保您已经登录海外 VPS 并在 /etc/ssh/sshd_config 中设置了：" -ForegroundColor Yellow
Write-Host "       GatewayPorts yes" -ForegroundColor Green
Write-Host "       并执行了 sudo systemctl restart sshd 重启了 SSH 服务。" -ForegroundColor Yellow
Write-Host "       (这能允许外部设备例如手机、海外朋友通过您的 VPS IP 访问转发的端口)" -ForegroundColor Yellow
Write-Host ""
Write-Host "---------------------------------------------------------"

$username = Read-Host "请输入您的 VPS SSH 用户名 [默认: root]"
if ([string]::IsNullOrEmpty($username)) {
    $username = "root"
}

$vps_ip = "207.57.131.146"

Write-Host ""
Write-Host "准备建立连接通道: 本地 localhost:5173/8080 <===> VPS $vps_ip:5173/8080" -ForegroundColor Cyan
Write-Host "即将启动 SSH 反向端口映射..." -ForegroundColor Yellow
Write-Host "连接成功后，本终端窗口将挂起保持连接，测试期间请勿关闭此窗口。" -ForegroundColor Yellow
Write-Host "按下 Ctrl + C 可以随时终止通道连接。" -ForegroundColor Red
Write-Host ""
Write-Host "请输入您的 VPS SSH 密码以完成授权：" -ForegroundColor Cyan

# 使用 PowerShell 专用的单引号 Here-String 语法包装远程 Linux 命令
# 这能 100% 保证 Windows PowerShell 本地不会去尝试编译 Linux 的 if/then 语法，也绝不会发生中文乱码
$remote_cmd = @'
clear
echo '========================================================='
echo '      ⚡ MuseSync Remote VPS Environment Auto-Tune ⚡'
echo '========================================================='
echo ''
echo '⏳ [1/3] Releasing stale ports 5173 and 8080...'
sudo fuser -k 5173/tcp 8080/tcp 2>/dev/null
fuser -k 5173/tcp 8080/tcp 2>/dev/null
echo '✅ Ports successfully released!'
echo ''
echo '⏳ [2/3] Setting up VPS firewall for ports 5173/8080...'
if command -v ufw >/dev/null 2>&1; then
    sudo ufw allow 5173/tcp >/dev/null 2>&1
    sudo ufw allow 8080/tcp >/dev/null 2>&1
    echo '✅ UFW ports allowed!'
elif command -v firewall-cmd >/dev/null 2>&1; then
    sudo firewall-cmd --add-port=5173/tcp --permanent >/dev/null 2>&1
    sudo firewall-cmd --add-port=8080/tcp --permanent >/dev/null 2>&1
    sudo firewall-cmd --reload >/dev/null 2>&1
    echo '✅ Firewalld ports allowed!'
else
    echo '⚠️ Standard firewall tools not found. Please ensure port 5173/8080 is open in your cloud console.'
fi
echo ''
echo '⏳ [3/3] Establishing secure cross-border data tunnel...'
echo '🎉 MuseSync Distributed Tunnel Established Successfully!'
echo '---------------------------------------------------------'
echo ' 📱 Please open your mobile browser and navigate to:'
echo ' 🔗 http://207.57.131.146:5173'
echo '---------------------------------------------------------'
echo ' ⚠️ Note: Keep this terminal open during testing. Press Ctrl + C to exit.'

# Keep-alive loop to maintain the reverse tunnel
while true; do sleep 3600; done
'@

Write-Host "正在清理本地残留的 SSH 僵尸进程防冲突..." -ForegroundColor Yellow
Stop-Process -Name "ssh" -Force -ErrorAction SilentlyContinue

# 启动 SSH 反向隧道转发 (使用明确的 127.0.0.1 强制 IPv4 绑定)
ssh -o StrictHostKeyChecking=no -p 50520 -R *:5173:127.0.0.1:5173 -R *:8080:127.0.0.1:8080 "$username@$vps_ip" $remote_cmd



