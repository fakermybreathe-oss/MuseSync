# MuseSync Sync and Deploy Utility
# VPS IP: 207.57.131.146, Port: 50520

$vps_ip = "207.57.131.146"
$vps_port = "50520"
$vps_user = "root"

Clear-Host
Write-Host "=========================================================" -ForegroundColor Cyan
Write-Host "         MuseSync Code Sync & Deploy Tool" -ForegroundColor Cyan
Write-Host "=========================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host " [Info] Stale logs moved to local scratch/ folder." -ForegroundColor Yellow
Write-Host "        Syncing now only targets core application files." -ForegroundColor Green
Write-Host ""
Write-Host "---------------------------------------------------------"

function Show-Menu {
    Write-Host "[1] Pull code from GitHub (Pull)" -ForegroundColor White
    Write-Host "[2] Commit and Push modifications to GitHub (Push)" -ForegroundColor White
    Write-Host "[3] Deploy and restart VPS backend service (Deploy to VPS)" -ForegroundColor White
    Write-Host "[4] All-in-One: Push + Deploy immediately (All in One)" -ForegroundColor Green
    Write-Host "[5] Exit" -ForegroundColor Red
    Write-Host ""
}

function Perform-Pull {
    Write-Host "Pulling latest code from GitHub..." -ForegroundColor Cyan
    git pull
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Success: Code pulled successfully!" -ForegroundColor Green
    } else {
        Write-Host "Error: Pull failed. Please check network/conflicts." -ForegroundColor Red
    }
}

function Perform-Push {
    Write-Host "Checking local modifications..." -ForegroundColor Cyan
    git status
    Write-Host ""
    $msg = Read-Host "Enter Commit Message [Default: update: musesync code update]"
    if ([string]::IsNullOrEmpty($msg)) {
        $msg = "update: musesync code update"
    }
    
    Write-Host "Staging and committing files..." -ForegroundColor Cyan
    git add .
    git commit -m "$msg"
    
    Write-Host "Pushing code to GitHub..." -ForegroundColor Cyan
    git push
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Success: Push succeeded! Cloudflare Pages will build in minutes." -ForegroundColor Green
    } else {
        Write-Host "Error: Push failed. Check remote permissions." -ForegroundColor Red
    }
}

function Perform-Deploy {
    Write-Host "Preparing SSH connection to VPS..." -ForegroundColor Cyan
    Write-Host "Target VPS: ${vps_ip}:${vps_port}" -ForegroundColor Yellow
    Write-Host "Temporary VPS Password is: 1kMO4MrEvB00" -ForegroundColor Yellow
    Write-Host ""
    
    ssh -o StrictHostKeyChecking=no -p $vps_port "$vps_user@$vps_ip" 'cd /root/musesync || cd /root/MuseSync || cd /root/musesync_backend; echo "=== START DEPLOY ==="; git pull; pnpm install; pnpm --filter @musesync/server build; pm2 reload musesync-backend; echo "=== SUCCESS ==="; exit'
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Success: VPS updated and PM2 reloaded!" -ForegroundColor Green
    } else {
        Write-Host "Error: Deploy failed. Check password or connection." -ForegroundColor Red
    }
}

while ($true) {
    Show-Menu
    $choice = Read-Host "Select option [1-5]"
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
            Write-Host "Goodbye!" -ForegroundColor Cyan
            break
        }
        Default {
            Write-Host "Warning: Invalid option. Select 1-5." -ForegroundColor Red
            Write-Host ""
        }
    }
}
