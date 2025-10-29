import React from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import regions from '../data/regions';

export default function HospitalForm() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();

  const [form, setForm] = React.useState({
    website: '',
    hospitalName: '',
    city: regions[0].id,
    district: regions[0].districts[0][0],
    locationKeywords: '',
    serviceKeywords: '',
    femaleRatio: 50, // 0=남 100=여
    ages: {
      teens: false,
      twenties: false,
      thirties: false,
      forties: false,
      fifties: false,
      sixties: false,
      seventiesPlus: false,
    },
    summary: '',
  });

  const [errors, setErrors] = React.useState({});

  React.useEffect(() => {
    const selected = regions.find((r) => r.id === form.city);
    if (!selected) return;
    const validIds = selected.districts.map((d) => d[0]);
    if (!validIds.includes(form.district)) {
      setForm((f) => ({ ...f, district: selected.districts[0][0] }));
    }
  }, [form.city]);

  const onChange = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
  };

  const onAgeToggle = (key) => {
    setForm((f) => ({ ...f, ages: { ...f.ages, [key]: !f.ages[key] } }));
  };

  const malePct = 100 - Number(form.femaleRatio);
  const femalePct = Number(form.femaleRatio);

  const validate = () => {
    const next = {};
    // website required + simple URL pattern
    if (!form.website.trim()) next.website = t('errors.required');
    else {
      try {
        // Allow missing protocol by trying to prepend
        // But require at least something like example.com
        const url = new URL(form.website.includes('://') ? form.website : `https://${form.website}`);
        if (!url.host.includes('.')) next.website = t('errors.invalidUrl');
      } catch (_) {
        next.website = t('errors.invalidUrl');
      }
    }

    if (!form.hospitalName.trim()) next.hospitalName = t('errors.required');
    if (!form.serviceKeywords.trim()) next.serviceKeywords = t('errors.required');

    const hasAge = Object.values(form.ages).some(Boolean);
    if (!hasAge) next.ages = t('errors.ageRequired');

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validate()) {
      const firstErrorEl = document.querySelector('.invalid');
      if (firstErrorEl && firstErrorEl.scrollIntoView) firstErrorEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    const payload = { ...form, lang: i18n.resolvedLanguage };
    try {
      localStorage.setItem('hospitalForm', JSON.stringify(payload));
    } catch (_) {}
    // Go straight to results; results page will call API and handle states
    navigate('/loading');
  };

  const getCityLabel = (id) => {
    const r = regions.find((c) => c.id === id);
    if (!r) return id;
    return i18n.resolvedLanguage === 'jp' ? (r.labelJp || r.labelKo) : r.labelKo;
  };

  const getDistrictLabel = (cityId, distId) => {
    const r = regions.find((c) => c.id === cityId);
    if (!r) return distId;
    const d = r.districts.find((x) => x[0] === distId);
    if (!d) return distId;
    const [, ko, jp] = d;
    return i18n.resolvedLanguage === 'jp' ? (jp || ko) : ko;
  };

  const selectedCity = regions.find((r) => r.id === form.city) || regions[0];

  return (
    <div className="container">
      <form className="card" onSubmit={handleSubmit}>
        <h1 className="page-title">{t('title')}</h1>

        {/* Website */}
        <div className="field-group">
          <label htmlFor="website" className="field-label">{t('fields.website.label')}<span className="required">*</span></label>
          <input
            id="website"
            name="website"
            type="url"
            className={`text-input ${errors.website ? 'invalid' : ''}`}
            placeholder={t('fields.website.placeholder')}
            value={form.website}
            onChange={onChange}
            inputMode="url"
          />
          {errors.website && <div className="error-text">{errors.website}</div>}
        </div>

        {/* Hospital Name */}
        <div className="field-group">
          <label htmlFor="hospitalName" className="field-label">{t('fields.hospitalName.label')}<span className="required">*</span></label>
          <input
            id="hospitalName"
            name="hospitalName"
            type="text"
            className={`text-input ${errors.hospitalName ? 'invalid' : ''}`}
            placeholder={t('fields.hospitalName.placeholder')}
            value={form.hospitalName}
            onChange={onChange}
          />
          {errors.hospitalName && <div className="error-text">{errors.hospitalName}</div>}
        </div>

        {/* Location: City / District */}
        <div className="field-row">
          <div className="field-col">
            <label htmlFor="city" className="field-label">{t('fields.location.city')}<span className="required">*</span></label>
            <select id="city" name="city" className="select-input" value={form.city} onChange={onChange}>
              {regions.map((c) => (
                <option key={c.id} value={c.id}>{getCityLabel(c.id)}</option>
              ))}
            </select>
          </div>
          <div className="field-col">
            <label htmlFor="district" className="field-label">{t('fields.location.district')}<span className="required">*</span></label>
            <select id="district" name="district" className="select-input" value={form.district} onChange={onChange}>
              {selectedCity.districts.map(([id]) => (
                <option key={id} value={id}>{getDistrictLabel(form.city, id)}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Location keywords */}
        <div className="field-group">
          <label htmlFor="locationKeywords" className="field-label">{t('fields.location.keywords')}</label>
          <input
            id="locationKeywords"
            name="locationKeywords"
            type="text"
            className="text-input"
            placeholder={t('fields.location.placeholder')}
            value={form.locationKeywords}
            onChange={onChange}
          />
        </div>

        {/* Service keywords */}
        <div className="field-group">
          <label htmlFor="serviceKeywords" className="field-label">{t('fields.services.label')}<span className="required">*</span></label>
          <input
            id="serviceKeywords"
            name="serviceKeywords"
            type="text"
            className={`text-input ${errors.serviceKeywords ? 'invalid' : ''}`}
            placeholder={t('fields.services.placeholder')}
            value={form.serviceKeywords}
            onChange={onChange}
          />
          {errors.serviceKeywords && <div className="error-text">{errors.serviceKeywords}</div>}
        </div>

        {/* Gender slider */}
        <div className="field-group">
          <span className="field-label">{t('fields.target.label')}<span className="required">*</span></span>
          <div className="gender-row" aria-label="gender-balance">
            <span className="gender-end">{t('fields.target.male')}</span>
            <input
              type="range"
              min="0"
              max="100"
              step="1"
              className="range-input"
              value={form.femaleRatio}
              onChange={(e) => setForm((f) => ({ ...f, femaleRatio: Number(e.target.value) }))}
              aria-label="gender slider"
            />
            <span className="gender-end">{t('fields.target.female')}</span>
          </div>
          <div className="muted small">
            {t('fields.target.balance', { male: malePct, female: femalePct })}
          </div>
        </div>

        {/* Ages */}
        <div className="field-group">
          <span className="field-label">{t('fields.ages.label')}<span className="required">*</span></span>
          <div className="ages-grid">
            {([
              ['teens', '10s'],
              ['twenties', '20s'],
              ['thirties', '30s'],
              ['forties', '40s'],
              ['fifties', '50s'],
              ['sixties', '60s'],
              ['seventiesPlus', '70sPlus'],
            ]).map(([key, tKey]) => (
              <label key={key} className="checkbox">
                <input
                  type="checkbox"
                  checked={form.ages[key]}
                  onChange={() => onAgeToggle(key)}
                />
                <span>{t(`fields.ages.${tKey}`)}</span>
              </label>
            ))}
          </div>
          {errors.ages && <div className="error-text">{errors.ages}</div>}
        </div>

        {/* Summary */}
        <div className="field-group">
          <label htmlFor="summary" className="field-label">{t('fields.summary.label')}</label>
          <textarea
            id="summary"
            name="summary"
            className="textarea-input"
            placeholder={t('fields.summary.placeholder')}
            rows={3}
            value={form.summary}
            onChange={onChange}
          />
        </div>

        <div className="actions">
          <button type="submit" className="primary-btn">
            {t('actions.generate')}
          </button>
        </div>
      </form>
    </div>
  );
}
