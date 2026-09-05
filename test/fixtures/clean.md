# What the gate does

Everything the system might say passes through a single gate. Twelve checks run in a fixed order. The first is an engine kill switch, a production hard stop that silences every producer at once. Then consent, whether proactive behaviour is enabled on the profile, operating mode, a global snooze, a per-type mute, the user's intensity setting, timezone-aware quiet hours, a seven-day trust ramp for new users, a dismissal cooldown, and a daily interaction budget.

On rejection the gate logs the specific reason and returns it. On allow it returns the set of surfaces the suggestion should be routed to: feed, push, chat or voice.

I chose one gate rather than checks scattered through the pipeline for a reason I would defend. With one gate and a logged reason, "why was the user not told about this" has an answer. With checks spread across a pipeline, the honest answer is "somewhere, something returned false".

The counts differ (255, 207, 17) because the three documents do different work. A design specification says what and why. A plan says in what order. A runbook says how the thing reaches production and what to do at three in the morning when it does not.

Range dates like 2019–2021 are fine. So is code: `a — b`.
