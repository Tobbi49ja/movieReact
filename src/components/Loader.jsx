import React, { useEffect, useState } from "react";
import logo from "../assets/logo.png";

const Loader = () => {
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setFadeOut(true), 2000);

    const removeTimer = setTimeout(() => {
      const loader = document.querySelector(".loader-container");
      if (loader) loader.style.display = "none";
    }, 3000);

    return () => {
      clearTimeout(timer);
      clearTimeout(removeTimer);
    };
  }, []);

  return (
    <div className={`loader-container ${fadeOut ? "fade-out" : ""}`}>
      <img src={logo} alt="Loading..." className="loader-logo" />
    </div>
  );
};

export default Loader;
