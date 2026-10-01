import { useState } from 'react';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Input } from '../../components/Input';
import '../compositions.css';

/**
 * A realistic settings screen, assembled from the real components.
 *
 * This is a test environment, not a production page. It exists so that changing
 * a token has somewhere realistic to land: two Cards, three Inputs and Buttons
 * in four variants, which together touch nearly every component token.
 */
export function SettingsPanel() {
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [saved, setSaved] = useState(false);

  function handleSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaved(true);
  }

  function handleReset() {
    setEmail('');
    setDisplayName('');
    setSaved(false);
  }

  return (
    <div className="sei-composition">
      <div className="sei-composition__intro">
        <h2 className="sei-composition__title">Settings</h2>
        <p className="sei-composition__subtitle">
          Manage how your account appears and how we contact you.
        </p>
      </div>

      <Card
        title="Profile"
        description="This information is visible to people in your workspace."
        footer={
          <>
            <Button variant="primary" type="submit" form="sei-settings-form">
              Save changes
            </Button>
            <Button variant="ghost" onClick={handleReset}>
              Reset
            </Button>
          </>
        }
      >
        <form id="sei-settings-form" className="sei-form" onSubmit={handleSave}>
          <Input
            label="Display name"
            name="displayName"
            value={displayName}
            placeholder="Ada Lovelace"
            onChange={(event) => {
              setDisplayName(event.target.value);
              setSaved(false);
            }}
          />
          <Input
            label="Email address"
            name="email"
            type="email"
            value={email}
            placeholder="ada@example.com"
            hint="We will send a confirmation to this address."
            onChange={(event) => {
              setEmail(event.target.value);
              setSaved(false);
            }}
          />
        </form>
      </Card>

      <Card
        title="Notifications"
        description="Choose which changes we let you know about."
        footer={
          <Button variant="secondary" onClick={() => setSaved(true)}>
            Apply preferences
          </Button>
        }
      >
        <div className="sei-settings__section">
          <div className="sei-settings__option">
            <div className="sei-settings__option-text">
              <span className="sei-settings__option-label">Product updates</span>
              <span className="sei-settings__option-description">
                Occasional email about new features.
              </span>
            </div>
            <Button variant="secondary" size="sm">
              On
            </Button>
          </div>

          <div className="sei-settings__option">
            <div className="sei-settings__option-text">
              <span className="sei-settings__option-label">Security alerts</span>
              <span className="sei-settings__option-description">
                Always on. Required for your account to stay secure.
              </span>
            </div>
            <Button variant="ghost" size="sm" disabled>
              Always on
            </Button>
          </div>
        </div>
      </Card>

      <Card title="Session" description="Sign out of this browser.">
        <div className="sei-form__actions">
          <Button variant="destructive" onClick={() => setSaved(false)}>
            Sign out
          </Button>
        </div>
      </Card>

      <p className="sei-form__note" role="status">
        {saved ? 'Settings saved.' : 'No unsaved changes.'}
      </p>
    </div>
  );
}