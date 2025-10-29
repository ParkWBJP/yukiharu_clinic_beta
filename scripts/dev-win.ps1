$ErrorActionPreference = "Stop"
Start-Process -WindowStyle Normal -FilePath "powershell" -ArgumentList "-NoExit -Command npm run server"
Start-Process -WindowStyle Normal -FilePath "powershell" -ArgumentList "-NoExit -Command npm run client"

