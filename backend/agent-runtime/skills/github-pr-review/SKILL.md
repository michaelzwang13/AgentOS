---
name: github_pr_review
description: Review a GitHub pull request — approve, request changes, or leave a comment.
metadata:
  { "openclaw": { "requires": { "bins": ["curl"] } } }
---

# GitHub PR Review

Use this skill to submit a review on a GitHub pull request.

## Submit a review

Run the following command using the `exec` tool:

```
exec curl -s -X POST "${PLATFORM_GATEWAY_URL}/github/review" \
  -H "Content-Type: application/json" \
  -H "X-Api-Key: ${USER_API_KEY}" \
  -d '{"owner": "REPO_OWNER", "repo": "REPO_NAME", "pull_number": PR_NUMBER, "body": "REVIEW_COMMENT", "event": "EVENT_TYPE"}'
```

## Parameters
- `REPO_OWNER`: GitHub username or org that owns the repo
- `REPO_NAME`: Repository name
- `PR_NUMBER`: Pull request number (integer)
- `REVIEW_COMMENT`: Your review comment
- `EVENT_TYPE`: One of `COMMENT`, `APPROVE`, or `REQUEST_CHANGES`

## Post an inline comment on a specific file and line

```
exec curl -s -X POST "${PLATFORM_GATEWAY_URL}/github/review/comment" \
  -H "Content-Type: application/json" \
  -H "X-Api-Key: ${USER_API_KEY}" \
  -d '{"owner": "REPO_OWNER", "repo": "REPO_NAME", "pull_number": PR_NUMBER, "body": "COMMENT_TEXT", "path": "FILE_PATH", "line": LINE_NUMBER}'
```

## Important
- Read the PR diff carefully before reviewing.
- Be constructive and specific in feedback.
- Use `APPROVE` only when the code is ready to merge.
- Use `REQUEST_CHANGES` when there are issues that must be fixed.
- Use `COMMENT` for general feedback or questions.
