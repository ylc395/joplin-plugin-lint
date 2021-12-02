# What is _Lint_?

_Lint_, or _linter_, is a kind of tool for programmers to mark source code fragment(s) which doesn't conform to a specific format. Programmers usually use lint to find potential bugs or nonstandard code when they're coding.

For non-programmers, lint is also helpful when they hope to keep their writing conformed to specific formats. For example, someone may want to be reminded not to leave `todo:` in text.

![](./doc/no-todo.png)

[Textlint](https://textlint.github.io/) is an open-source lint tool for daily writing, with [many community-made rules](https://github.com/textlint/textlint/wiki/Collection-of-textlint-rule#contents). Each rule specify a format to check. For example, with [no-todo rule](https://github.com/textlint-rule/textlint-rule-no-todo), textlint will check whether `todo` or `- []` is existing in text.

Some textlint rules are also fixable, which means they can report and **fix** problems. For example, no-todo rule can remove `todo` mark for you if you choose to do so.

# Joplin with textlint

With this plugin, you can integrate textlint into Joplin. You can configure rules you like, to let textlint check and report.
