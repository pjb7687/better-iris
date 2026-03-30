# Better IRIS

A Tampermonkey userscript that enhances the [IRIS](https://www.iris.go.kr/) (Integrated Research Information System) for Korean R&D project management.

## Features

### My R&D Dashboard Enhancements
- Adds action buttons to the project grid for quick navigation
- Direct links to agreement change requests and performance registration

### ORCID Paper Auto-fill
- Inline ORCID paper search section injected into the paper registration modal
- Search papers by ORCID iD (saved in localStorage for convenience)
- Auto-fills paper metadata from Crossref:
  - Title, journal name, DOI, ISSN, ISBN
  - Volume, pages, publication/print dates
  - Authors (first author / co-authors / publisher)
  - Abstract (with fallbacks to OpenAlex, Semantic Scholar, Europe PMC)
  - Keywords, international collaboration status
  - Journal country (via OpenAlex with manual override support)
- Sortable results table with clickable column headers

## Installation

1. Install [Tampermonkey](https://www.tampermonkey.net/) browser extension
2. Create a new userscript and paste the contents of `better-iris.js`

## Journal Country Overrides

OpenAlex sometimes reports the publisher's country instead of the journal's actual country of origin. The file `journal-country-overrides.json` contains manual corrections mapping ISSN to IRIS country codes (`PH****`).

The userscript fetches this file from the GitHub raw URL before falling back to OpenAlex.

### Adding a correction

Edit `journal-country-overrides.json` and add the ISSN with the correct IRIS country code:

```json
{
  "1016-8478": "PH1410"
}
```

Country codes follow the IRIS `cboIssuNatSe` format (e.g., `PH1410` = South Korea, `PH1840` = USA, `PH1826` = UK). See `country-map.json` for the full ISO alpha-2 to IRIS code mapping.

## Files

| File | Description |
|------|-------------|
| `better-iris.js` | Main Tampermonkey userscript |
| `journal-country-overrides.json` | Manual ISSN-to-country corrections |
| `country-map.json` | ISO alpha-2 to IRIS country code reference |

## License

MIT
