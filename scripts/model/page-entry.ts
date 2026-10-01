// Injected into each page by dataset.ts: what the model reads for every labelled field, computed by
// the engine's own first pass (src/fill), so the dataset is what the extension sees.
import { firstPass } from '../../src/fill/context';
import { listControls } from '../../src/fill/extract';
import { modelInputs } from '../../src/fill/model';

(globalThis as unknown as { __devfillerDataset: () => unknown[] }).__devfillerDataset = () => {
  const controls = listControls();
  const fields = firstPass(controls);
  return modelInputs(controls, fields).flatMap(({ el, info }) => {
    const expect = el.getAttribute('data-expect');
    return expect ? [{ index: controls.indexOf(el), expect, info }] : [];
  });
};
