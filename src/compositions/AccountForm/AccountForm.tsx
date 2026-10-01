import { useState } from 'react';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Input } from '../../components/Input';
import '../compositions.css';

/**
 * A realistic account form, assembled from the real components.
 *
 * Includes the states that matter for inspection: an invalid-email error, a
 * disabled submit, and a destructive action that requires an explicit second
 * click. It is a test environment, not a production page.
 */
export function AccountForm() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [touched, setTouched] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const emailError =
    touched && email.length > 0 && !email.includes('@')
      ? 'Enter a valid email address.'
      : undefined;

  const canSubmit = fullName.trim().length > 0 && email.includes('@');

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setTouched(true);
  }

  function handleReset() {
    setFullName('');
    setEmail('');
    setTouched(false);
  }

  return (
    <div className="sei-composition">
      <div className="sei-composition__intro">
        <h2 className="sei-composition__title">Create your account</h2>
        <p className="sei-composition__subtitle">
          You can change any of this later in settings.
        </p>
      </div>

      <Card
        title="Account details"
        description="We use your name and email to set up your workspace."
        footer={
          <>
            <Button variant="primary" type="submit" form="sei-account-form" disabled={!canSubmit}>
              Create account
            </Button>
            <Button variant="ghost" onClick={handleReset}>
              Cancel
            </Button>
          </>
        }
      >
        <form id="sei-account-form" className="sei-form" onSubmit={handleSubmit} noValidate>
          <Input
            label="Full name"
            name="fullName"
            value={fullName}
            placeholder="Ada Lovelace"
            onChange={(event) => setFullName(event.target.value)}
          />
          <Input
            label="Email address"
            name="email"
            type="email"
            value={email}
            placeholder="ada@example.com"
            error={emailError}
            hint="We will send a confirmation to this address."
            onChange={(event) => setEmail(event.target.value)}
            onBlur={() => setTouched(true)}
          />
        </form>
      </Card>

      <Card
        title="Danger zone"
        description="Deleting your account removes all of your data. This cannot be undone."
        footer={
          confirmingDelete ? (
            <>
              <Button variant="destructive" onClick={() => setConfirmingDelete(false)}>
                Delete permanently
              </Button>
              <Button variant="secondary" onClick={() => setConfirmingDelete(false)}>
                Keep account
              </Button>
            </>
          ) : (
            <Button variant="destructive" onClick={() => setConfirmingDelete(true)}>
              Delete account
            </Button>
          )
        }
      >
        <p className="sei-form__note">
          {confirmingDelete
            ? 'Confirm below. Your data will be removed immediately.'
            : 'This action is permanent.'}
        </p>
      </Card>
    </div>
  );
}