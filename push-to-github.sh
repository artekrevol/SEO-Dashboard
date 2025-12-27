#!/bin/bash
# Script to push Replit changes to GitHub
# Usage: ./push-to-github.sh [GITHUB_TOKEN]
# Or set GITHUB_TOKEN environment variable

set -e

echo "=== Pushing Replit changes to GitHub ==="
echo ""

# Check if token is provided
if [ -n "$1" ]; then
    GITHUB_TOKEN="$1"
elif [ -n "$GITHUB_TOKEN" ]; then
    echo "Using GITHUB_TOKEN from environment"
else
    echo "Error: GitHub token required"
    echo ""
    echo "Usage:"
    echo "  ./push-to-github.sh YOUR_GITHUB_TOKEN"
    echo "  OR"
    echo "  GITHUB_TOKEN=your_token ./push-to-github.sh"
    echo ""
    echo "To create a GitHub token:"
    echo "  1. Go to https://github.com/settings/tokens"
    echo "  2. Click 'Generate new token (classic)'"
    echo "  3. Select 'repo' scope"
    echo "  4. Copy the token and use it here"
    exit 1
fi

# Update remote URL to use token
REPO_URL="https://${GITHUB_TOKEN}@github.com/artekrevol/SEO-Dashboard.git"
git remote set-url origin "$REPO_URL"

# Show what will be pushed
echo "Commits to push: $(git log origin/main..HEAD --oneline | wc -l)"
echo ""
echo "Recent commits:"
git log origin/main..HEAD --oneline -10
echo ""

# Push to GitHub
echo "Pushing to GitHub..."
git push origin main

echo ""
echo "✅ Successfully pushed to GitHub!"
echo ""
echo "Note: For security, consider removing the token from git config:"
echo "  git remote set-url origin https://github.com/artekrevol/SEO-Dashboard.git"



