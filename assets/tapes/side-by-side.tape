# Render: vhs assets/tapes/side-by-side.tape (from the repo root)
# Needs @oakoliver/lipgloss 1.1.0 or newer installed (see examples/README.md).
Output assets/tapes/.side-by-side.gif
Set Shell bash
Set FontSize 13
Set Width 1240
Set Height 720
Set Padding 24
Set Theme "Catppuccin Mocha"
Set TypingSpeed 40ms

Hide
Type "export PS1='> ' && clear"
Enter
Show

Type "bun examples/side-by-side.ts"
Enter
Sleep 2s
Screenshot assets/side-by-side.png
