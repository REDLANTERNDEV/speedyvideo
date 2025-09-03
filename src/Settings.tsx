import { useEffect, useState } from "react";
import { LogoSvg } from "./components/LogoSvg";
import { useTheme } from "./context/ThemeContext";

interface DomainSpeed {
  id?: string;
  domain: string;
  speed: number;
}

interface BlacklistDomain {
  id?: string;
  domain: string;
}

type ValidationMessageType = "error" | "warning" | "success" | "";

interface ValidationResult {
  isValid: boolean;
  message: string;
  type: ValidationMessageType;
}

interface DomainValidationErrors {
  domain: ValidationResult;
  speed: ValidationResult;
}

type SettingsTab = "speed" | "blacklist";

export default function Settings({
  onClose,
}: {
  readonly onClose: () => void;
}) {
  const [activeTab, setActiveTab] = useState<SettingsTab>("speed");
  const [domainSpeeds, setDomainSpeeds] = useState<DomainSpeed[]>([]);
  const [blacklistDomains, setBlacklistDomains] = useState<BlacklistDomain[]>(
    []
  );
  const { darkMode } = useTheme();
  const [domainErrors, setDomainErrors] = useState<DomainValidationErrors[]>(
    []
  );
  const [blacklistErrors, setBlacklistErrors] = useState<ValidationResult[]>(
    []
  );

  // Helper function to create empty validation result
  const createEmptyValidation = (): ValidationResult => ({
    isValid: true,
    message: "",
    type: "",
  });

  // Helper function to generate unique IDs
  const generateId = () =>
    `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

  useEffect(() => {
    if (chrome?.storage?.local) {
      chrome.storage.local.get(
        ["domainSpeeds", "blacklistDomains"],
        (result) => {
          // Load domain speeds
          if (Array.isArray(result.domainSpeeds)) {
            const domainsWithIds = result.domainSpeeds.map(
              (domain: DomainSpeed) => ({
                ...domain,
                id: domain.id || generateId(),
              })
            );
            setDomainSpeeds(domainsWithIds);
            setDomainErrors(
              domainsWithIds.map(() => ({
                domain: createEmptyValidation(),
                speed: createEmptyValidation(),
              }))
            );
          } else {
            setDomainSpeeds([]);
            setDomainErrors([]);
          }

          // Load blacklist domains
          if (Array.isArray(result.blacklistDomains)) {
            const blacklistWithIds = result.blacklistDomains.map(
              (domain: BlacklistDomain) => ({
                ...domain,
                id: domain.id || generateId(),
              })
            );
            setBlacklistDomains(blacklistWithIds);
            setBlacklistErrors(
              blacklistWithIds.map(() => createEmptyValidation())
            );
          } else {
            setBlacklistDomains([]);
            setBlacklistErrors([]);
          }
        }
      );
    }
  }, []);

  // Enhanced validation functions with user-friendly messages
  const validateDomain = (
    domain: string
  ): {
    isValid: boolean;
    message: string;
    type: "error" | "warning" | "success" | "";
  } => {
    const trimmed = domain.trim();
    if (trimmed === "") {
      return { isValid: false, message: "", type: "" }; // Don't show error for empty on typing
    }

    // Check for basic format first
    if (trimmed.length < 3) {
      return { isValid: false, message: "Domain too short", type: "warning" };
    }

    // Check for valid characters
    if (!/^[a-zA-Z0-9.-]+$/.test(trimmed)) {
      return {
        isValid: false,
        message: "Use only letters, numbers, dots, and hyphens",
        type: "error",
      };
    }

    // Check for proper domain format (allow www. prefix)
    if (!/^(www\.)?[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(trimmed)) {
      return {
        isValid: false,
        message: "Enter a valid domain (e.g., youtube.com)",
        type: "warning",
      };
    }

    // Check for protocol or path (still not allowed)
    if (trimmed.startsWith("http") || trimmed.includes("/")) {
      return {
        isValid: false,
        message: "Enter domain only (e.g., youtube.com)",
        type: "warning",
      };
    }

    return { isValid: true, message: "Valid domain ✓", type: "success" };
  };

  const validateSpeed = (
    speed: number
  ): {
    isValid: boolean;
    message: string;
    type: "error" | "warning" | "success" | "";
  } => {
    if (isNaN(speed)) {
      return { isValid: false, message: "Enter a number", type: "warning" };
    }

    if (speed < 0.1) {
      return {
        isValid: false,
        message: "Minimum speed is 0.1x",
        type: "warning",
      };
    }

    if (speed > 16) {
      return { isValid: false, message: "Maximum speed is 16x", type: "error" };
    }

    // Reduce aggressive warnings - only warn for extremely slow/fast speeds
    if (speed < 0.25) {
      return { isValid: true, message: "Very slow playback", type: "warning" };
    }

    if (speed > 8) {
      return { isValid: true, message: "Very fast playback", type: "warning" };
    }

    return { isValid: true, message: "", type: "" }; // No message for normal speeds
  };

  // Save function
  const handleSave = () => {
    // Validate domain speeds
    const domainValidationResults = domainSpeeds.map((item) => ({
      domain: validateDomain(item.domain),
      speed: validateSpeed(item.speed),
    }));

    // Validate blacklist domains
    const blacklistValidationResults = blacklistDomains.map((item) =>
      validateDomain(item.domain)
    );

    setDomainErrors(domainValidationResults);
    setBlacklistErrors(blacklistValidationResults);

    const hasDomainErrors = domainValidationResults.some(
      (error) => !error.domain.isValid || !error.speed.isValid
    );
    const hasBlacklistErrors = blacklistValidationResults.some(
      (error) => !error.isValid
    );

    if (hasDomainErrors || hasBlacklistErrors) {
      return;
    }

    // Clean up domain speeds
    const cleanDomainSpeeds = domainSpeeds.map((item) => ({
      domain: item.domain.trim().toLowerCase(),
      speed: parseFloat(Math.max(0.1, Math.min(16, item.speed)).toFixed(2)),
    }));

    // Clean up blacklist domains
    const cleanBlacklistDomains = blacklistDomains.map((item) => ({
      domain: item.domain.trim().toLowerCase(),
    }));

    if (chrome?.storage?.local) {
      chrome.storage.local.set(
        {
          domainSpeeds: cleanDomainSpeeds,
          blacklistDomains: cleanBlacklistDomains,
        },
        () => {
          onClose();
        }
      );
    } else {
      onClose();
    }
  };

  // Domain speed functions
  const updateDomainField = (
    index: number,
    field: "domain" | "speed",
    value: string | number
  ) => {
    const newList = [...domainSpeeds];
    newList[index] = { ...newList[index], [field]: value };
    setDomainSpeeds(newList);

    // Update errors immediately for better UX
    const newErrors = [...domainErrors];
    if (field === "domain" && typeof value === "string") {
      newErrors[index] = { ...newErrors[index], domain: validateDomain(value) };
    } else if (field === "speed" && typeof value === "number") {
      newErrors[index] = { ...newErrors[index], speed: validateSpeed(value) };
    }
    setDomainErrors(newErrors);
  };

  const addNewDomain = () => {
    if (domainSpeeds.length < 20) {
      const newId = generateId();
      setDomainSpeeds([...domainSpeeds, { id: newId, domain: "", speed: 1.0 }]);
      setDomainErrors([
        ...domainErrors,
        {
          domain: createEmptyValidation(),
          speed: createEmptyValidation(),
        },
      ]);
    }
  };

  const removeDomain = (index: number) => {
    const newList = domainSpeeds.filter((_, i) => i !== index);
    const newErrors = domainErrors.filter((_, i) => i !== index);
    setDomainSpeeds(newList);
    setDomainErrors(newErrors);
  };

  const resetDomains = () => {
    setDomainSpeeds([]);
    setDomainErrors([]);
  };

  // Blacklist functions
  const addNewBlacklistDomain = () => {
    if (blacklistDomains.length < 50) {
      const newId = generateId();
      setBlacklistDomains([...blacklistDomains, { id: newId, domain: "" }]);
      setBlacklistErrors([...blacklistErrors, createEmptyValidation()]);
    }
  };

  const removeBlacklistDomain = (index: number) => {
    const newList = blacklistDomains.filter((_, i) => i !== index);
    const newErrors = blacklistErrors.filter((_, i) => i !== index);
    setBlacklistDomains(newList);
    setBlacklistErrors(newErrors);
  };

  const resetBlacklist = () => {
    setBlacklistDomains([]);
    setBlacklistErrors([]);
  };

  const updateBlacklistDomain = (index: number, value: string) => {
    const newList = [...blacklistDomains];
    newList[index] = { ...newList[index], domain: value };
    setBlacklistDomains(newList);

    const newErrors = [...blacklistErrors];
    newErrors[index] = validateDomain(value);
    setBlacklistErrors(newErrors);
  };

  return (
    <div className="settings-container">
      <div className="settings-header">
        <div className="settings-logo">
          <LogoSvg fillColor={darkMode ? "#FFFFFF" : "#000000"} />
        </div>
        <h1 className="settings-title">SpeedyVideo Settings</h1>
        <p className="settings-subtitle">Customize your video experience</p>
      </div>

      <div className="settings-tabs">
        <button
          className={`tab-button ${activeTab === "speed" ? "active" : ""}`}
          onClick={() => setActiveTab("speed")}
        >
          <span className="tab-icon">⚡</span>
          <span>Domain Speeds</span>
        </button>
        <button
          className={`tab-button ${activeTab === "blacklist" ? "active" : ""}`}
          onClick={() => setActiveTab("blacklist")}
        >
          <span className="tab-icon">🚫</span>
          <span>Blacklist</span>
        </button>
      </div>

      <div className="settings-content">
        {activeTab === "speed" && (
          <div className="tab-panel">
            <div className="panel-header">
              <h3>Custom Speed Settings</h3>
              <p>Set specific playback speeds for different websites</p>
            </div>

            {/* Add button at the top for better visibility */}
            <div className="top-actions">
              {domainSpeeds.length < 20 && (
                <button className="add-button primary" onClick={addNewDomain}>
                  <span>+</span> Add New Domain
                </button>
              )}
            </div>

            <div className="tab-content">
              {domainSpeeds.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon">⚡</div>
                  <h4>No custom speeds configured</h4>
                  <p>
                    Add domains to automatically apply specific playback speeds
                    when you visit them.
                  </p>
                </div>
              ) : (
                <div className="domain-list">
                  {domainSpeeds.map((domainSpeed, index) => {
                    const domainId = `domain-${index}`;
                    const speedId = `speed-${index}`;

                    return (
                      <div
                        key={domainSpeed.id || `domain-${index}`}
                        className="domain-item"
                      >
                        <div className="domain-inputs">
                          <div className="input-group">
                            <label htmlFor={domainId}>Domain</label>
                            <input
                              id={domainId}
                              type="text"
                              placeholder="youtube.com or www.twitch.tv"
                              value={domainSpeed.domain}
                              onChange={(e) =>
                                updateDomainField(
                                  index,
                                  "domain",
                                  e.target.value
                                )
                              }
                              className={`domain-input ${
                                domainErrors[index]?.domain.type === "error"
                                  ? "error"
                                  : ""
                              }`}
                            />
                            {domainErrors[index]?.domain.message && (
                              <span
                                className={`error-message ${domainErrors[index].domain.type}`}
                              >
                                {domainErrors[index].domain.message}
                              </span>
                            )}
                          </div>

                          <div className="input-group">
                            <label htmlFor={speedId}>Speed</label>
                            <input
                              id={speedId}
                              type="number"
                              min="0.1"
                              max="16"
                              step="0.1"
                              placeholder="1.0 (0.1-16x)"
                              value={
                                domainSpeed.speed === 0 ? "" : domainSpeed.speed
                              }
                              onChange={(e) => {
                                const value = e.target.value;
                                if (value === "") {
                                  updateDomainField(index, "speed", 0);
                                } else {
                                  const numValue = parseFloat(value);
                                  if (!isNaN(numValue)) {
                                    updateDomainField(index, "speed", numValue);
                                  }
                                }
                              }}
                              className={`speed-input ${
                                domainErrors[index]?.speed.type === "error"
                                  ? "error"
                                  : ""
                              }`}
                            />
                            {domainErrors[index]?.speed.message && (
                              <span
                                className={`error-message ${domainErrors[index].speed.type}`}
                              >
                                {domainErrors[index].speed.message}
                              </span>
                            )}
                          </div>
                        </div>

                        <button
                          className="remove-button"
                          onClick={() => removeDomain(index)}
                          title="Remove this domain"
                        >
                          <span>×</span>
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="panel-actions">
              {domainSpeeds.length > 0 && (
                <button className="reset-button" onClick={resetDomains}>
                  Reset All
                </button>
              )}
            </div>
          </div>
        )}

        {activeTab === "blacklist" && (
          <div className="tab-panel">
            <div className="panel-header">
              <h3>Domain Blacklist</h3>
              <p>Completely disable SpeedyVideo on specific websites</p>
            </div>

            {/* Add button at the top for better visibility */}
            <div className="top-actions">
              {blacklistDomains.length < 50 && (
                <button
                  className="add-button primary"
                  onClick={addNewBlacklistDomain}
                >
                  <span>+</span> Add New Domain
                </button>
              )}
            </div>

            <div className="tab-content">
              {blacklistDomains.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon">🚫</div>
                  <h4>No blacklisted domains</h4>
                  <p>
                    Add domains where you want SpeedyVideo to be completely
                    disabled.
                  </p>
                </div>
              ) : (
                <div className="blacklist-list">
                  {blacklistDomains.map((blacklistDomain, index) => {
                    const domainId = `blacklist-domain-${index}`;

                    return (
                      <div
                        key={blacklistDomain.id || `blacklist-${index}`}
                        className="blacklist-item"
                      >
                        <div className="blacklist-inputs">
                          <div className="input-group">
                            <label htmlFor={domainId}>Domain</label>
                            <input
                              id={domainId}
                              type="text"
                              placeholder="example.com or www.site.com"
                              value={blacklistDomain.domain}
                              onChange={(e) =>
                                updateBlacklistDomain(index, e.target.value)
                              }
                              className={`domain-input ${
                                blacklistErrors[index]?.type === "error"
                                  ? "error"
                                  : ""
                              }`}
                            />
                            {blacklistErrors[index]?.message && (
                              <span
                                className={`error-message ${blacklistErrors[index].type}`}
                              >
                                {blacklistErrors[index].message}
                              </span>
                            )}
                          </div>
                        </div>

                        <button
                          className="remove-button"
                          onClick={() => removeBlacklistDomain(index)}
                          title="Remove from blacklist"
                        >
                          <span>×</span>
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="panel-actions">
              {blacklistDomains.length > 0 && (
                <button className="reset-button" onClick={resetBlacklist}>
                  Reset All
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="settings-footer">
        <div className="footer-actions">
          <button className="cancel-button" onClick={onClose}>
            Cancel
          </button>
          <button className="save-button" onClick={handleSave}>
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}
