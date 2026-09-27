// Command generate renders the golden files in tests/golden with real
// charm.land/glamour/v2 v2.0.1.
//
//	go run . matrix   # tests/golden/fixtures/*.md -> tests/golden/v2.0.1/
//	go run . upstream # tests/golden/upstream/{examples,issues} (renderer_test.go corpus)
//
// Run from this directory.
package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"

	"charm.land/glamour/v2"
	"charm.land/glamour/v2/ansi"
	"github.com/yuin/goldmark"
	emoji "github.com/yuin/goldmark-emoji"
	"github.com/yuin/goldmark/extension"
	"github.com/yuin/goldmark/parser"
	"github.com/yuin/goldmark/renderer"
	"github.com/yuin/goldmark/util"
)

var (
	styles = []string{"dark", "light", "dracula", "tokyo-night", "pink", "notty", "ascii"}
	widths = []int{40, 80}
)

func main() {
	if len(os.Args) < 2 {
		fmt.Fprintln(os.Stderr, "usage: go run . matrix|upstream")
		os.Exit(2)
	}
	switch os.Args[1] {
	case "matrix":
		// glamour registers its chroma theme ("charm") in a process-global
		// registry the first time a code block is highlighted, and never
		// replaces it. Render each style in its own process so every golden
		// carries that style's own highlighting colors.
		for _, s := range styles {
			cmd := exec.Command(os.Args[0], "matrix-style", s)
			cmd.Stdout, cmd.Stderr = os.Stdout, os.Stderr
			must(cmd.Run())
		}
	case "matrix-style":
		matrix("../fixtures", "../v2.0.1", os.Args[2])
	case "upstream":
		upstream("../upstream")
	default:
		fmt.Fprintln(os.Stderr, "unknown mode", os.Args[1])
		os.Exit(2)
	}
}

func must(err error) {
	if err != nil {
		panic(err)
	}
}

// matrix renders every fixture in one standard style at widths 40 and 80
// through the public TermRenderer API.
func matrix(fixtures, out, s string) {
	files, err := filepath.Glob(filepath.Join(fixtures, "*.md"))
	must(err)
	must(os.MkdirAll(out, 0o755))
	for _, f := range files {
		src, err := os.ReadFile(f)
		must(err)
		name := strings.TrimSuffix(filepath.Base(f), ".md")
		for _, w := range widths {
			r, err := glamour.NewTermRenderer(glamour.WithStandardStyle(s), glamour.WithWordWrap(w))
			must(err)
			res, err := r.Render(string(src))
			must(err)
			p := filepath.Join(out, fmt.Sprintf("%s.%s.%d.golden", name, s, w))
			must(os.WriteFile(p, []byte(res), 0o644))
		}
	}
}

func render(in []byte, options ansi.Options) []byte {
	md := goldmark.New(
		goldmark.WithExtensions(extension.GFM, extension.DefinitionList, emoji.Emoji),
		goldmark.WithParserOptions(parser.WithAutoHeadingID()),
	)
	ar := ansi.NewRenderer(options)
	md.SetRenderer(renderer.NewRenderer(renderer.WithNodeRenderers(util.Prioritized(ar, 1000))))
	var buf bytes.Buffer
	must(md.Convert(in, &buf))
	return buf.Bytes()
}

// upstream re-renders glamour's own ansi/renderer_test.go corpus with the
// options TestRenderer and TestRendererIssues use.
func upstream(dir string) {
	examples, err := filepath.Glob(filepath.Join(dir, "examples", "*.md"))
	must(err)
	for _, f := range examples {
		bn := strings.TrimSuffix(filepath.Base(f), ".md")
		in, err := os.ReadFile(f)
		must(err)
		st, err := os.ReadFile(filepath.Join(dir, "examples", bn+".style"))
		must(err)
		options := ansi.Options{WordWrap: 80}
		must(json.Unmarshal(st, &options.Styles))
		switch bn {
		case "table_wrap":
			v := true
			options.TableWrap = &v
		case "table_truncate":
			v := false
			options.TableWrap = &v
		case "table_with_inline_links":
			options.InlineTableLinks = true
		}
		must(os.WriteFile(filepath.Join(dir, "examples", bn+".golden"), render(in, options), 0o644))
	}

	dark, err := os.ReadFile(filepath.Join(dir, "dark.json"))
	must(err)
	issues, err := filepath.Glob(filepath.Join(dir, "issues", "*.md"))
	must(err)
	for _, f := range issues {
		bn := strings.TrimSuffix(filepath.Base(f), ".md")
		in, err := os.ReadFile(f)
		must(err)
		options := ansi.Options{WordWrap: 80}
		must(json.Unmarshal(dark, &options.Styles))
		if bn == "493" {
			v := false
			options.TableWrap = &v
		}
		must(os.WriteFile(filepath.Join(dir, "issues", bn+".golden"), render(in, options), 0o644))
	}
}
