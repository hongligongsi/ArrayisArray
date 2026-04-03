# Git Upload Script - PowerShell Version

Write-Host "==============================================" -ForegroundColor Cyan
Write-Host "           Git 上传脚本" -ForegroundColor Cyan
Write-Host "==============================================" -ForegroundColor Cyan
Write-Host ""

# Get commit message from user
$commitMsg = Read-Host "请输入提交信息 (按回车使用默认信息)"
if (-not $commitMsg) {
    $commitMsg = "更新代码"
}

Write-Host ""
Write-Host "开始上传代码..." -ForegroundColor Yellow
Write-Host ""

# Stage all changes
Write-Host "1. 添加所有更改..."
git add .

# Commit changes
Write-Host "2. 提交更改..."
git commit -m "$commitMsg"

# Push to remote
Write-Host "3. 推送到远程仓库..."
git push origin main

# Check result
if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "✅ 代码上传成功！" -ForegroundColor Green
} else {
    Write-Host ""
    Write-Host "❌ 代码上传失败，请检查网络连接" -ForegroundColor Red
}

Write-Host ""
Write-Host "按任意键退出..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")