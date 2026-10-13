import { useEffect, useState } from 'react';
import { Check } from 'lucide-react';
import { createMockService, servicePrice } from '../data/mockServices';
import './MockCreateService.css';

// TEMPORARY: stands in for the real "Create service" page (Services tab)
// until it's connected. Opened in a new tab from the service picker at
// ?mock=create-service. Saves to this browser, so the picker tab sees the
// new service as soon as they switch back to it.
export default function MockCreateService() {
  const [title, setTitle] = useState('');
  const [paid, setPaid] = useState(true);
  const [price, setPrice] = useState('');
  const [created, setCreated] = useState(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    document.title = 'Create service (mock)';
  }, []);

  const canSave = title.trim() !== '' && (!paid || Number(price) > 0);

  const save = () => {
    if (!canSave) return;
    const service = createMockService({ title, price: paid ? price : 0 });
    setFailed(!service);
    if (service) setCreated(service);
  };

  // Tabs opened from the Page Builder can close themselves
  const closeTab = () => window.close();

  return <div>This should redirect to the create service page</div>
}