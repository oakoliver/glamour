# Render: vhs assets/tapes/themes.tape (from the repo root)
Output assets/themes.gif

Set Shell bash
Set FontSize 15
Set Width 860
Set Height 350
Set Padding 24
Set Theme "Catppuccin Mocha"
Set TypingSpeed 35ms

Hide
Type "export PS1='> ' && clear"
Enter
Show

Type "bun examples/render.ts examples/theme.md dark"
Enter
Sleep 2.5s
Hide
Type "clear"
Enter
Show
Type "bun examples/render.ts examples/theme.md dracula"
Enter
Sleep 2.5s
Hide
Type "clear"
Enter
Show
Type "bun examples/render.ts examples/theme.md tokyo-night"
Enter
Sleep 2.5s
Hide
Type "clear"
Enter
Show
Type "bun examples/render.ts examples/theme.md ascii"
Enter
Sleep 2.5s
