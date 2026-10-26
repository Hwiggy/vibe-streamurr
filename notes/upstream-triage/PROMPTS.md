# Prompt log

All user prompts that drove work in this folder, verbatim, in order.

## Session 1 (2026-10-26)

### Prompt 1

> This is a fork of https://github.com/obsproject/obs-studio
>
> Your goal: go through all open issues and PRs
> Justify them based on existing code where possible.
> Implement the smallest possible slice to implement the changes if they seem relevant to the scope of the original project. Call out the ones that dont via github link & your reasoning.
>
> The caveats:
> This will never be merged into upstream. No PRs from the published repo shall ever be created. You must document all of your reasoning. Keep as many notes as you like, but they must be saved into a folder for future reference. Any notes relevant to a commit must be addressed in the commit long text. Changes must be license compliant. All prompts must be saved in such a note. You may create a CLAUDE.md to help future sessions.
>
> Testing should be done where applicable. If we cannot perform testing due to system constraints, that should be noted as UNTESTED in the commit long text.

(Invoked with `/workflow-authoring`; ultracode mode on.)

### Sub-agent prompts

Workflow and sub-agent prompts used to do the triage and implementation are saved
alongside this file in `workflows/` (verbatim scripts) so the reasoning chain is reproducible.
