import * as React from 'react';
import * as ReactDOM from 'react-dom/client';
import SmartSlideLink from './components/smart-slide-link/component';

const uuid = document.currentScript?.getAttribute('uuid') || 'root';

const root = ReactDOM.createRoot(document.getElementById(uuid) as HTMLElement);
root.render(<SmartSlideLink pluginUuid={uuid} />);
