import { coreElements } from './core/coreElements';

export const elements = {
  ...coreElements,

  // Presentation toolbar buttons registered by the plugin. The data-test comes from
  // buildToolbarButtonDataTest() in src/components/smart-slide-link/service.ts.
  smartSlideLinkButtons: 'button[data-test^="smartSlideLinkButton-"]',
  smartSlideLinkButton: (index: number) => `button[data-test="smartSlideLinkButton-${index}"]`,
};
