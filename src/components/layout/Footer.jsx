import React from "react";
import "../../styles/Footer.css";
function Footer() {
  return (
    <footer className="site-footer">
      <div className="footer-content">
        <div>
          <strong>Disclaimer:</strong> All data, posters, and streams are
          sourced from{" "}
          <a
            href="https://hdrezka.ag/"
            target="_blank"
            rel="noopener noreferrer"
          >
            HDRezka
          </a>
          <br />
          <div>
            This is a fan-made, non-commercial website for educational and
            personal use only. No content is stored on our servers. All rights
            to content belong to their respective owners.
          </div>
        </div>
        <div className="footer-jokes">
          <span>
            &copy; {new Date().getFullYear()} Not Netflix. All wrongs reserved.
          </span>
        </div>
      </div>
    </footer>
  );
}

export default Footer;
