# PowerShell 資料夾選擇對話框
Add-Type -AssemblyName System.Windows.Forms

$folderBrowser = New-Object System.Windows.Forms.FolderBrowserDialog
$folderBrowser.Description = "請選擇要轉換的網站資料夾"
$folderBrowser.ShowNewFolderButton = $false

$result = $folderBrowser.ShowDialog()

if ($result -eq [System.Windows.Forms.DialogResult]::OK) {
    Write-Output $folderBrowser.SelectedPath
} else {
    Write-Output ""
}

