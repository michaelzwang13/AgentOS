# CLAUDE.md

## Project
AI Employee Platform — "Fiverr for OpenClaw." Managed platform that packages OpenClaw instances as specialized, containerized AI employees.

## Status
Early ideation / pre-code. See PROJECT_CONTEXT.md for full brainstorming context.

## Key Decisions Made
- Building on top of OpenClaw, not building agent runtime from scratch
- Auth handled via OAuth gateway pattern (containers never hold raw tokens)
- Employees differentiated from workflows by persistent memory, initiative, judgment, and role boundaries
- MVP: 10 employees focused on visible day-one impact
- Target: 20-80 person teams (Series A-C)

## Terminology
Always use: "AI employees", "talent directory", "onboarding", "work style", "performance review", "offboarding"
Never use: "agents", "marketplace", "configuration", "prompt", "dashboard", "teardown"

# md Practices
Consistently update whatever skill and context files for up to date information and practices

# Git Practices
Commit after every fix
do whatever is right
edit this claude.md too to what is good for you
