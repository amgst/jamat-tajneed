import { useEffect, useState } from 'react';
import { Button, Modal } from 'antd';
import { Download, Share, Smartphone } from 'lucide-react';
import { clearInstallPrompt, getInstallPrompt } from '../lib/pwa';
import './InstallApp.css';

const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || !!(navigator as Navigator & { standalone?: boolean }).standalone;

export default function InstallApp() {
  const [installed, setInstalled] = useState(isStandalone);
  const [open, setOpen] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [prompt, setPrompt] = useState(getInstallPrompt);
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  useEffect(() => {
    const update = () => setPrompt(getInstallPrompt());
    const onInstalled = () => { setInstalled(true); setOpen(false); };
    const displayMode = window.matchMedia('(display-mode: standalone)');
    const onDisplayChange = () => setInstalled(isStandalone());
    window.addEventListener('tajneed-install-change', update);
    window.addEventListener('appinstalled', onInstalled);
    displayMode.addEventListener('change', onDisplayChange);
    return () => {
      window.removeEventListener('tajneed-install-change', update);
      window.removeEventListener('appinstalled', onInstalled);
      displayMode.removeEventListener('change', onDisplayChange);
    };
  }, []);
  const install = async () => {
    if (!prompt) { setOpen(true); return; }
    setInstalling(true);
    try {
      await prompt.prompt();
      await prompt.userChoice;
      clearInstallPrompt();
    } catch { setOpen(true); }
    finally { setInstalling(false); }
  };
  if (installed) return null;
  return <>
    <Button className="install-app-button" icon={<Download size={16} />} onClick={install} loading={installing}>Install</Button>
    <Modal title="Take Tajneed with you" open={open} onCancel={() => setOpen(false)} footer={<Button onClick={() => setOpen(false)}>Got it</Button>} width={420}>
      <div className="install-app-help"><Smartphone size={36} /><p>Keep the directory on your home screen and open it like an app.</p>
        {!window.isSecureContext ? <p>Open Tajneed from its published HTTPS address to enable installation on your phone. This local HTTP address supports previewing the app.</p> : ios ? <ol><li>Open this address in Safari.</li><li>Tap <Share size={15} /> <strong>Share</strong>, then <strong>Add to Home Screen</strong>.</li><li>Keep “Open as Web App” enabled if shown, then tap <strong>Add</strong>.</li></ol> : <ol><li>Open your browser’s menu.</li><li>Choose <strong>Install app</strong> or <strong>Add to Home screen</strong>.</li><li>Confirm to add Tajneed.</li></ol>}
        <p className="install-app-note">An internet connection is needed to load and update records.</p>
      </div>
    </Modal>
  </>;
}
