Step-by-Step Workflow
Create the Remote Repository: Go to GitHub and create a new repository. Do not initialize it with a README, .gitignore, or license, as this creates a separate history that conflicts with your local code. 
Initialize Local Git: Open your terminal, navigate to your project folder, and initialize the local repository:
git init

Stage and Commit Files: Add all local files and make your initial commit:
git add .
git commit -m "Initial commit"

Rename Default Branch (If Necessary): If your local default branch is named master but GitHub expects main, rename it:
git branch -M main

Connect Remote Origin: Add the URL of your new GitHub repository as the remote origin (replace <username> and <repo> with your details):
git remote add origin https://github.com/<username>/<repo>.git

Push to GitHub: Push your local commits to the remote repository:
git push -u origin main


echo ".backup/" >> .gitignore git rm -r --cached .backup git add .gitignore git commit -m "Stop tracking .backup and add to .gitignore" git push origin main