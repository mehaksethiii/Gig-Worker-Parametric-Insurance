@echo off
echo ========================================
echo Pushing to GitHub Repository
echo ========================================
echo.

REM Initialize git if needed
git init

REM Add remote repository
git remote add origin https://github.com/mehaksethiii/Gig-Worker-Parametric-Insurance.git 2>nul
git remote set-url origin https://github.com/mehaksethiii/Gig-Worker-Parametric-Insurance.git

REM Add all files
echo Adding all files...
git add .

REM Commit changes
echo Committing changes...
git commit -m "Complete RideShield platform with modern UI, images, and video demo"

REM Push to GitHub
echo Pushing to GitHub...
git push -u origin main

echo.
echo ========================================
echo Done! Check your repository at:
echo https://github.com/mehaksethiii/Gig-Worker-Parametric-Insurance
echo ========================================
pause
