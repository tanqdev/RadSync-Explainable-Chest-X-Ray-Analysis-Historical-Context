<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## ThoraxAI architecture
- Preserve the provided TanStack Start and Vite bootstrap; use file-based TanStack routes instead of introducing another router so the hosted preview remains compatible.
- Keep research behavior entirely client-side with in-memory session state and isolated mock service adapters; no backend requests are needed for this prototype.
- Place reusable medical workspace components outside route modules and keep mock records in a dedicated data module to enable future FastAPI integration.
- Express visual roles through the global semantic token system and use the existing shadcn controls for accessible interactions.
