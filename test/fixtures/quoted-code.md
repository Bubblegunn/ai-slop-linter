+++
title = "A — B in TOML front matter"
+++

# Quoting code and diffs

A README often quotes a diff in an indented block:

    --- a/src/gate.ts
    +++ b/src/gate.ts
    -  const delve = "tapestry";
    +  const name = "gate";

A tab-indented block, which is the same construct:

	-  let's dive into it — really

Inside a blockquote, a fenced block still holds code:

> ```sh
> slop --fix -  it's a testament to nothing
> ```

An HTML block holds code too:

<pre>
-  seamless, robust, and vibrant — I hope this helps
</pre>

An ordinary list is not a code block and keeps its findings:

- the first item
- the second item

Prose outside every block still counts - this hyphen is a real finding.
