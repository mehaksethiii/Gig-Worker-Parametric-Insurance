# 🚀 Push to GitHub Repository

Follow these steps to push all your code to: `mehaksethiii/Gig-Worker-Parametric-Insurance`

## Step 1: Initialize Git (if not already done)

```bash
git init
```

## Step 2: Add Remote Repository

```bash
git remote add origin https://github.com/mehaksethiii/Gig-Worker-Parametric-Insurance.git
```

If you already have a remote, update it:
```bash
git remote set-url origin https://github.com/mehaksethiii/Gig-Worker-Parametric-Insurance.git
```

## Step 3: Add All Files

```bash
git add .
```

## Step 4: Commit Changes

```bash
git commit -m "Complete RideShield platform with modern UI and all features"
```

## Step 5: Push to GitHub

```bash
git push -u origin main
```

If your branch is named `master` instead of `main`:
```bash
git push -u origin master
```

## If You Get Errors

### Error: "failed to push some refs"
This means the remote has changes you don't have locally. Pull first:
```bash
git pull origin main --rebase
git push -u origin main
```

### Error: "Permission denied"
You need to authenticate. Use one of these methods:

**Option 1: Personal Access Token**
1. Go to GitHub → Settings → Developer settings → Personal access tokens
2. Generate new token with `repo` permissions
3. Use token as password when pushing

**Option 2: SSH Key**
```bash
ssh-keygen -t ed25519 -C "your_email@example.com"
cat ~/.ssh/id_ed25519.pub
```
Copy the output and add to GitHub → Settings → SSH Keys

### Force Push (if needed - use carefully!)
```bash
git push -u origin main --force
```

## Verify Upload

After pushing, visit:
https://github.com/mehaksethiii/Gig-Worker-Parametric-Insurance

You should see all your files there!

## What's Being Pushed

✅ Complete frontend with React
✅ Backend with Node.js + Express
✅ All images (hero, features, steps)
✅ MongoDB models
✅ API routes
✅ README and documentation
✅ Package.json files
✅ All CSS styling

## Quick Commands Summary

```bash
# All in one go:
git init
git remote add origin https://github.com/mehaksethiii/Gig-Worker-Parametric-Insurance.git
git add .
git commit -m "Complete RideShield platform with modern UI and all features"
git push -u origin main
```

---

**Need Help?** If you encounter any errors, share the error message and I'll help you fix it!
