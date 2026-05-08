"""Shared payment / settlement semantics."""

# User-to-user transfers that affect interpersonal totals & payment UX.
PEER_PAYMENT_TYPES = frozenset({'PERSONAL', 'GROUP', 'BANKER_TRANSFER'})

# Bank cash-in / cash-out on a customer wallet — not a loan or group debt.
WALLET_ADJUSTMENT_TYPES = frozenset({'BANKER_ADD', 'BANKER_REMOVE'})
