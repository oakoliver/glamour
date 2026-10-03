# Render: vhs assets/tapes/hero.tape (from the repo root)
Output assets/hero.gif

Set Shell bash
Set FontSize 15
Set Width 860
Set Height 770
Set Padding 24
Set Theme "Catppuccin Mocha"
Set TypingSpeed 40ms

Hide
Type "export PS1='> ' && clear"
Enter
Show

Type "bun examples/render.ts examples/sample.md"
Sleep 400ms
Enter
Sleep 4s
