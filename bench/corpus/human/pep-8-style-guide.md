This document gives coding conventions for the Python code comprising the standard library in the main Python distribution.  Please see the companion informational PEP describing :pep:`style guidelines for the C code in the C implementation of Python <7>`.

This document and :pep:`257` (Docstring Conventions) were adapted from Guido's original Python Style Guide essay, with some additions from Barry's style guide [2]_.

This style guide evolves over time as additional conventions are identified and past conventions are rendered obsolete by changes in the language itself.

Many projects have their own coding style guidelines. In the event of any conflicts, such project-specific guides take precedence for that project.

A Foolish Consistency is the Hobgoblin of Little Minds

One of Guido's key insights is that code is read much more often than it is written.  The guidelines provided here are intended to improve the readability of code and make it consistent across the wide spectrum of Python code.  As :pep:`20` says, "Readability counts".

A style guide is about consistency.  Consistency with this style guide is important.  Consistency within a project is more important. Consistency within one module or function is the most important.

However, know when to be inconsistent -- sometimes style guide recommendations just aren't applicable.  When in doubt, use your best judgment.  Look at other examples and decide what looks best.  And don't hesitate to ask!

In particular: do not break backwards compatibility just to comply with this PEP!

Some other good reasons to ignore a particular guideline:

1. When applying the guideline would make the code less readable, even

2. To be consistent with surrounding code that also breaks it (maybe

3. Because the code in question predates the introduction of the

4. When the code needs to remain compatible with older versions of

Continuation lines should align wrapped elements either vertically using Python's implicit line joining inside parentheses, brackets and braces, or using a *hanging indent* [#fn-hi]_.  When using a hanging indent the following should be considered; there should be no arguments on the first line and further indentation should be used to clearly distinguish itself as a continuation line:

When the conditional part of an ``if``-statement is long enough to require that it be written across multiple lines, it's worth noting that the combination of a two character keyword (i.e. ``if``), plus a single space, plus an opening parenthesis creates a natural 4-space indent for the subsequent lines of the multiline conditional.  This can produce a visual conflict with the indented suite of code nested inside the ``if``-statement, which would also naturally be indented to 4 spaces.  This PEP takes no explicit position on how (or whether) to further visually distinguish such conditional lines from the nested suite inside the ``if``-statement. Acceptable options in this situation include, but are not limited to:

(Also see the discussion of whether to break before or after binary operators below.)

The closing brace/bracket/parenthesis on multiline constructs may either line up under the first non-whitespace character of the last line of list, as in:

or it may be lined up under the first character of the line that starts the multiline construct, as in:

Tabs should be used solely to remain consistent with code that is already indented with tabs.

Limit all lines to a maximum of 79 characters.

For flowing long blocks of text with fewer structural restrictions (docstrings or comments), the line length should be limited to 72 characters.

Limiting the required editor window width makes it possible to have several files open side by side, and works well when using code review tools that present the two versions in adjacent columns.

The default wrapping in most tools disrupts the visual structure of the code, making it more difficult to understand. The limits are chosen to avoid wrapping in editors with the window width set to 80, even if the tool places a marker glyph in the final column when wrapping lines. Some web based tools may not offer dynamic line wrapping at all.

Some teams strongly prefer a longer line length.  For code maintained exclusively or primarily by a team that can reach agreement on this issue, it is okay to increase the line length limit up to 99 characters, provided that comments and docstrings are still wrapped at 72 characters.

The Python standard library is conservative and requires limiting lines to 79 characters (and docstrings/comments to 72).

The preferred way of wrapping long lines is by using Python's implied line continuation inside parentheses, brackets and braces.  Long lines can be broken over multiple lines by wrapping expressions in parentheses. These should be used in preference to using a backslash for line continuation.

Backslashes may still be appropriate at times.  For example, long, multiple ``with``-statements could not use implicit continuation before Python 3.10, so backslashes were acceptable for that case:

(See the previous discussion on `multiline if-statements`_ for further thoughts on the indentation of such multiline ``with``-statements.)

Should a Line Break Before or After a Binary Operator?

For decades the recommended style was to break after binary operators. But this can hurt readability in two ways: the operators tend to get scattered across different columns on the screen, and each operator is moved away from its operand and onto the previous line.  Here, the eye has to do extra work to tell which items are added and which are subtracted:

To solve this readability problem, mathematicians and their publishers follow the opposite convention.  Donald Knuth explains the traditional rule in his *Computers and Typesetting* series: "Although formulas within a paragraph always break after binary operations and relations, displayed formulas always break before binary operations" [3]_.

Following the tradition from mathematics usually results in more readable code:

In Python code, it is permissible to break before or after a binary operator, as long as the convention is consistent locally.  For new code Knuth's style is suggested.

Surround top-level function and class definitions with two blank lines.

Method definitions inside a class are surrounded by a single blank line.

Extra blank lines may be used (sparingly) to separate groups of related functions.  Blank lines may be omitted between a bunch of related one-liners (e.g. a set of dummy implementations).

Use blank lines in functions, sparingly, to indicate logical sections.

Python accepts the control-L (i.e. ^L) form feed character as whitespace; many tools treat these characters as page separators, so you may use them to separate pages of related sections of your file. Note, some editors and web-based code viewers may not recognize control-L as a form feed and will show another glyph in its place.

Code in the core Python distribution should always use UTF-8, and should not have an encoding declaration.

In the standard library, non-UTF-8 encodings should be used only for test purposes. Use non-ASCII characters sparingly, preferably only to denote places and human names. If using non-ASCII characters as data, avoid noisy Unicode characters like z̯̯͡a̧͎̺l̡͓̫g̹̲o̡̼̘ and byte order marks.

All identifiers in the Python standard library MUST use ASCII-only identifiers, and SHOULD use English words wherever feasible (in many cases, abbreviations and technical terms are used which aren't English).

Open source projects with a global audience are encouraged to adopt a similar policy.

- Imports are always put at the top of the file, just after any module comments and docstrings, and before module globals and constants.
