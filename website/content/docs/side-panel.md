The side panel sits beside the website and follows the tab you're on. Open it with **Alt+Shift+F**, or right-click the toolbar icon → **Open DevFiller panel**.

## See what happened to each field

The panel lists every form field on the page as **filled**, **skipped** or **incompatible**, with the reason. Filter the list by **Filled** or **Skipped**. Select a field to highlight it on the page with **Show on page**.

Click **Fill this page** in the panel to fill, or **Fill again** for new values. The list refreshes when you switch tabs or the page changes, and every few seconds while the panel is open. Click the refresh button to update it now.

## Fix one field

Select a field to:

- **Save field rule**: give this field a fixed test value on this website. The rule targets that exact field and takes priority over everything else. Use **Fill again** to apply it.
- **Exclude this field**: skip it on this website from now on.

Both appear in the options afterwards, under [Custom fields](/docs/custom-fields/) and [Excluded fields](/docs/excluded-fields/), where you can edit or delete them. If the website changes its markup, create the rule again.

## Undo last fill

**Undo last fill** restores the values from before the last fill on this page. Fields you changed yourself after the fill are kept. Undo is cleared when the page reloads, and it can't reverse things the website did in reaction to the fill.

The previous values stay in the page's isolated extension context. They are never saved or sent anywhere.
