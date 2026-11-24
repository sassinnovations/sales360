
"use client";

import { Country, State, City } from "country-state-city";

type Props = {
  country: string;
  state: string;
  city: string;
  onChange: (name: string, value: string) => void;
};

export function AccountLocationFields({
  country,
  state,
  city,
  onChange,
}: Props) {
  const countries = Country.getAllCountries().sort((a, b) =>
    a.name.localeCompare(b.name),
  );

  const selectedCountry = countries.find(
    (item) => item.name === country,
  );

  const states = selectedCountry
    ? State.getStatesOfCountry(selectedCountry.isoCode).sort((a, b) =>
        a.name.localeCompare(b.name),
      )
    : [];

  const selectedState = states.find((item) => item.name === state);

  const cities =
    selectedCountry && selectedState
      ? City.getCitiesOfState(
          selectedCountry.isoCode,
          selectedState.isoCode,
        ).sort((a, b) => a.name.localeCompare(b.name))
      : [];

  return (
    <div className="field wide">
      <span>Location</span>

      <div className="form-grid">
        <label className="field">
          <span>Country</span>
          <select
            name="country"
            value={country}
            onChange={(event) => {
              onChange("country", event.target.value);
              onChange("state", "");
              onChange("city", "");
            }}
          >
            <option value="">Select country</option>
            {countries.map((item) => (
              <option key={item.isoCode} value={item.name}>
                {item.name}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>State / Province</span>
          <select
            name="state"
            value={state}
            disabled={!selectedCountry || states.length === 0}
            onChange={(event) => {
              onChange("state", event.target.value);
              onChange("city", "");
            }}
          >
            <option value="">Select state / province</option>
            {states.map((item) => (
              <option
                key={`${item.countryCode}-${item.isoCode}`}
                value={item.name}
              >
                {item.name}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>City</span>
          <select
            name="city"
            value={city}
            disabled={!selectedState || cities.length === 0}
            onChange={(event) => onChange("city", event.target.value)}
          >
            <option value="">Select city</option>
            {cities.map((item, index) => (
              <option
                key={`${item.stateCode}-${item.name}-${index}`}
                value={item.name}
              >
                {item.name}
              </option>
            ))}
          </select>
        </label>
      </div>
    </div>
  );
}
