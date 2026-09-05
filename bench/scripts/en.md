# Release notes

The sampler now reads the repository once — a second pass was doing the same work twice. Runs on a large repository finish in about half the time they did, and the output is unchanged. Nothing in the command line moved, so an existing script keeps working.

The change is covered by a test that fails on the old path, and by a run over a public repository whose numbers are recorded in the pull request. Two people reported the slow path within a week of each other, which is what moved it up the list.

Reading the repository once also removed a class of mistake: the two passes could disagree when a file changed between them, and the second pass silently won. That could not be reproduced on demand, so it was never filed as a defect, but it is gone now.

The remaining cost is memory. A repository with a very large number of files now holds more in memory at once, and the limit has not been measured. If that becomes a problem, the fix is to read in batches, which is a smaller change than this one was.
