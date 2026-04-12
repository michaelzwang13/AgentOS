---
name: github_list_prs
description: List open pull requests for a GitHub repository.
metadata:
  { "openclaw": { "requires": { "bins": ["curl"] } } }
---

# GitHub List Pull Requests

Use this skill to fetch open pull requests for a repository.

## List open PRs

```
exec curl -s "${PLATFORM_GATEWAY_URL}/github/pulls/REPO_OWNER/REPO_NAME" \
  -H "X-Api-Key: ${USER_API_KEY}"
```

## Get a specific PR

```
exec curl -s "${PLATFORM_GATEWAY_URL}/github/pulls/REPO_OWNER/REPO_NAME/PR_NUMBER" \
  -H "X-Api-Key: ${USER_API_KEY}"
```

## Parameters
- `REPO_OWNER`: GitHub username or org that owns the repo
- `REPO_NAME`: Repository name
- `PR_NUMBER`: Pull request number (integer)

## Important
- Use this to check for new PRs that need review.
- Parse the JSON response to extract PR titles, authors, and descriptions.
