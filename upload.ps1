Write-Host "Git 上传脚本"
Write-Host "============="

$commitMsg = Read-Host "请输入提交信息"
if (-not $commitMsg) { $commitMsg = "更新代码" }

Write-Host "开始上传..."

git add .
git commit -m $commitMsg
git push origin main

Write-Host "上传完成！"