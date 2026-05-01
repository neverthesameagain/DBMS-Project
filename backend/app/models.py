from .extensions import db
from datetime import datetime, timezone

def now():
    return datetime.now(timezone.utc)


# =============================================================
# Category
# =============================================================
class Category(db.Model):
    __tablename__ = 'category'

    category_id   = db.Column(db.Integer, primary_key=True)
    category_name = db.Column(db.String(80), nullable=False, unique=True)

    def to_dict(self):
        return {'category_id': self.category_id, 'category_name': self.category_name}


# =============================================================
# User
# =============================================================
class User(db.Model):
    __tablename__ = 'users'

    user_id         = db.Column(db.Integer, primary_key=True)
    first_name      = db.Column(db.String(50),  nullable=False)
    last_name       = db.Column(db.String(50),  nullable=False)
    email           = db.Column(db.String(120), nullable=False, unique=True)
    phone_number    = db.Column(db.String(20),  nullable=False, unique=True)
    date_of_birth   = db.Column(db.Date)
    gender          = db.Column(db.String(10))
    hashed_password = db.Column(db.String(128), nullable=False)
    opening_balance = db.Column(db.Numeric(12, 2), default=0.00)
    current_balance = db.Column(db.Numeric(12, 2), default=0.00)
    role            = db.Column(db.String(10), nullable=False, default='USER')
    is_active       = db.Column(db.Boolean, nullable=False, default=True)
    created_at      = db.Column(db.DateTime(timezone=True), default=now)

    # Relationships
    upi_ids           = db.relationship('UpiId',              backref='user', lazy=True, cascade='all, delete-orphan')
    group_memberships = db.relationship('GroupMember',        backref='user', lazy=True, cascade='all, delete-orphan')
    personal_splits   = db.relationship('PersonalExpenseSplit', backref='user', lazy=True, cascade='all, delete-orphan')
    expenses_paid     = db.relationship('ExpenseSplitGroup',  backref='payer', lazy=True, foreign_keys='ExpenseSplitGroup.paid_by')
    expenses_for      = db.relationship('ExpenseSplitGroup',  backref='debtor', lazy=True, foreign_keys='ExpenseSplitGroup.paid_for')
    payments_sent     = db.relationship('Payment',            backref='sender',   lazy=True, foreign_keys='Payment.from_user_id')
    payments_received = db.relationship('Payment',            backref='receiver', lazy=True, foreign_keys='Payment.to_user_id')
    future_expenses   = db.relationship('FutureExpense',      backref='user', lazy=True, cascade='all, delete-orphan')

    def to_dict(self):
        return {
            'user_id':         self.user_id,
            'first_name':      self.first_name,
            'last_name':       self.last_name,
            'email':           self.email,
            'phone_number':    self.phone_number,
            'opening_balance': float(self.opening_balance or 0),
            'current_balance': float(self.current_balance or 0),
            'role':            self.role,
            'is_active':       self.is_active,
        }


# =============================================================
# UPI ID
# =============================================================
class UpiId(db.Model):
    __tablename__ = 'upi_id'

    upi_id     = db.Column(db.Integer, primary_key=True)
    user_id    = db.Column(db.Integer, db.ForeignKey('users.user_id', ondelete='CASCADE'), nullable=False)
    upi_handle = db.Column(db.String(100), nullable=False, unique=True)

    def to_dict(self):
        return {'upi_id': self.upi_id, 'upi_handle': self.upi_handle}


# =============================================================
# Group
# =============================================================
class Group(db.Model):
    __tablename__ = 'groups'

    group_id   = db.Column(db.Integer, primary_key=True)
    group_name = db.Column(db.String(100), nullable=False)
    created_at = db.Column(db.DateTime(timezone=True), default=now)

    members  = db.relationship('GroupMember',       backref='group', lazy=True, cascade='all, delete-orphan')
    expenses = db.relationship('ExpenseSplitGroup', backref='group', lazy=True, cascade='all, delete-orphan')

    def to_dict(self):
        return {
            'group_id':   self.group_id,
            'group_name': self.group_name,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }


# =============================================================
# Group Member  (Admin | Moderator | Member)
# =============================================================
class GroupMember(db.Model):
    __tablename__ = 'group_members'

    group_id  = db.Column(db.Integer, db.ForeignKey('groups.group_id', ondelete='CASCADE'), primary_key=True)
    user_id   = db.Column(db.Integer, db.ForeignKey('users.user_id',  ondelete='CASCADE'), primary_key=True)
    role      = db.Column(db.String(20), nullable=False, default='Member')
    joined_at = db.Column(db.DateTime(timezone=True), default=now)

    def to_dict(self):
        u = self.user
        return {
            'user_id':    self.user_id,
            'first_name': u.first_name if u else '',
            'last_name':  u.last_name  if u else '',
            'email':      u.email      if u else '',
            'role':       self.role,
            'joined_at':  self.joined_at.isoformat() if self.joined_at else None,
        }


# =============================================================
# Personal Expense Split  (user budget by category)
# =============================================================
class PersonalExpenseSplit(db.Model):
    __tablename__ = 'personal_expense_split'

    user_id          = db.Column(db.Integer, db.ForeignKey('users.user_id',    ondelete='CASCADE'), primary_key=True)
    category_id      = db.Column(db.Integer, db.ForeignKey('category.category_id', ondelete='CASCADE'), primary_key=True)
    allocated_amount = db.Column(db.Numeric(12, 2), nullable=False, default=0.00)
    amount_spent     = db.Column(db.Numeric(12, 2), nullable=False, default=0.00)
    reminder_for     = db.Column(db.Date)
    duration         = db.Column(db.Integer, default=30)

    category = db.relationship('Category')

    def to_dict(self):
        return {
            'category_id':      self.category_id,
            'category_name':    self.category.category_name if self.category else '',
            'allocated_amount': float(self.allocated_amount or 0),
            'amount_spent':     float(self.amount_spent or 0),
            'remaining':        float((self.allocated_amount or 0) - (self.amount_spent or 0)),
            'reminder_for':     self.reminder_for.isoformat() if self.reminder_for else None,
            'duration':         self.duration,
        }


# =============================================================
# Transaction  (unified financial ledger)
# =============================================================
class Transaction(db.Model):
    __tablename__ = 'transactions'

    transaction_id   = db.Column(db.Integer, primary_key=True)
    transaction_type = db.Column(db.String(20), nullable=False)   # 'EXPENSE' | 'PAYMENT'
    reference_id     = db.Column(db.Integer,    nullable=False)   # PK of the referenced row
    amount           = db.Column(db.Numeric(12, 2), nullable=False)
    created_at       = db.Column(db.DateTime(timezone=True), default=now)

    def to_dict(self):
        return {
            'transaction_id':   self.transaction_id,
            'transaction_type': self.transaction_type,
            'reference_id':     self.reference_id,
            'amount':           float(self.amount or 0),
            'created_at':       self.created_at.isoformat() if self.created_at else None,
        }


# =============================================================
# Payment
# =============================================================
class Payment(db.Model):
    __tablename__ = 'payment'

    payment_id    = db.Column(db.Integer, primary_key=True)
    from_user_id  = db.Column(db.Integer, db.ForeignKey('users.user_id', ondelete='CASCADE'), nullable=False)
    to_user_id    = db.Column(db.Integer, db.ForeignKey('users.user_id', ondelete='CASCADE'), nullable=False)
    category_id   = db.Column(db.Integer, db.ForeignKey('category.category_id', ondelete='SET NULL'), nullable=True)
    amount        = db.Column(db.Numeric(12, 2), nullable=False)
    upi_ref       = db.Column(db.String(100))
    payment_type  = db.Column(db.String(20), nullable=False, default='PERSONAL')  # PERSONAL | GROUP
    status        = db.Column(db.String(20), nullable=False, default='COMPLETED') # PENDING | COMPLETED | FAILED
    note          = db.Column(db.String(200))
    transaction_id = db.Column(db.Integer, db.ForeignKey('transactions.transaction_id', ondelete='RESTRICT'), nullable=False)
    created_at    = db.Column(db.DateTime(timezone=True), default=now)

    category    = db.relationship('Category')
    transaction = db.relationship('Transaction')

    def to_dict(self):
        return {
            'payment_id':   self.payment_id,
            'from_user_id': self.from_user_id,
            'from_name':    f'{self.sender.first_name} {self.sender.last_name}' if self.sender else '',
            'to_user_id':   self.to_user_id,
            'to_name':      f'{self.receiver.first_name} {self.receiver.last_name}' if self.receiver else '',
            'category':     self.category.category_name if self.category else None,
            'amount':       float(self.amount or 0),
            'payment_type': self.payment_type,
            'status':       self.status,
            'note':         self.note,
            'created_at':   self.created_at.isoformat() if self.created_at else None,
        }


# =============================================================
# Expense Split Group
#   Each row = one member's share of a group expense.
#   paid_by  = who fronted the cash
#   paid_for = who owes that share (debtor)
# =============================================================
class ExpenseSplitGroup(db.Model):
    __tablename__ = 'expense_split_group'

    expense_id  = db.Column(db.Integer, primary_key=True)
    payment_id  = db.Column(db.Integer, db.ForeignKey('payment.payment_id',     ondelete='SET NULL'), nullable=True)
    group_id    = db.Column(db.Integer, db.ForeignKey('groups.group_id',         ondelete='CASCADE'),  nullable=False)
    category_id = db.Column(db.Integer, db.ForeignKey('category.category_id',   ondelete='SET NULL'), nullable=True)
    paid_by     = db.Column(db.Integer, db.ForeignKey('users.user_id',           ondelete='CASCADE'),  nullable=False)
    paid_for    = db.Column(db.Integer, db.ForeignKey('users.user_id',           ondelete='CASCADE'),  nullable=False)
    amount      = db.Column(db.Numeric(12, 2), nullable=False)
    description = db.Column(db.String(200))
    is_settled  = db.Column(db.Boolean, default=False)
    created_at  = db.Column(db.DateTime(timezone=True), default=now)

    category = db.relationship('Category')

    def to_dict(self):
        return {
            'expense_id':   self.expense_id,
            'group_id':     self.group_id,
            'paid_by':      self.paid_by,
            'payer_name':   f'{self.payer.first_name} {self.payer.last_name}' if self.payer else '',
            'paid_for':     self.paid_for,
            'debtor_name':  f'{self.debtor.first_name} {self.debtor.last_name}' if self.debtor else '',
            'amount':       float(self.amount or 0),
            'description':  self.description,
            'category':     self.category.category_name if self.category else 'General',
            'is_settled':   self.is_settled,
            'created_at':   self.created_at.isoformat() if self.created_at else None,
        }


# =============================================================
# Future Expense
# =============================================================
class FutureExpense(db.Model):
    __tablename__ = 'future_expense'

    future_expense_id = db.Column(db.Integer, primary_key=True)
    user_id           = db.Column(db.Integer, db.ForeignKey('users.user_id',    ondelete='CASCADE'), nullable=False)
    category_id       = db.Column(db.Integer, db.ForeignKey('category.category_id', ondelete='SET NULL'), nullable=True)
    estimated_amount  = db.Column(db.Numeric(12, 2), nullable=False)
    expected_date     = db.Column(db.Date)
    status            = db.Column(db.String(20), nullable=False, default='PLANNED')  # PLANNED | COMPLETED | CANCELLED
    created_at        = db.Column(db.DateTime(timezone=True), default=now)

    category = db.relationship('Category')

    def to_dict(self):
        return {
            'future_expense_id': self.future_expense_id,
            'user_id':           self.user_id,
            'category_id':       self.category_id,
            'category_name':     self.category.category_name if self.category else 'General',
            'estimated_amount':  float(self.estimated_amount or 0),
            'expected_date':     self.expected_date.isoformat() if self.expected_date else None,
            'status':            self.status,
            'created_at':        self.created_at.isoformat() if self.created_at else None,
        }
