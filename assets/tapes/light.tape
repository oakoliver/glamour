# Render: vhs assets/tapes/light.tape (from the repo root)

Set Shell bash
Set FontSize 15
Set Width 860
Set Height 350
Set Padding 24
Set Theme "Catppuccin Latte"
Set TypingSpeed 35ms

Hide
Type "export PS1='> ' && clear"
Enter
Show

Type "bun examples/render.ts examples/theme.md light"
Enter
Sleep 2s
Screenshot assets/light.png
