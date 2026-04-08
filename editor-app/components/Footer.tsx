import Link from "next/link";
import pkg from "../package.json";

function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="app-footer">
      <div className="container-fluid px-4">
        <div className="row">
          {/* Left - Links */}
          <div className="col-lg-4 col-md-4 col-sm-12 mb-3 mb-lg-0 text-center text-md-start">
            <div className="footer-links">
              <h6 className="footer-links-title mb-2">More</h6>
              <ul className="footer-links-list list-unstyled mb-0">
                <li className="footer-links-item mb-1">
                <Link
                  className="footer-link text-decoration-none"
                  href="https://digitaltwinhub.co.uk/networks/29-the-apollo-protocol"
                >
                  Get in touch
                </Link>
                </li>
                <li className="footer-links-item">
                <Link
                  className="footer-link text-decoration-none"
                  href="https://github.com/Apollo-Protocol/4d-activity-editor/discussions"
                >
                  Give feedback
                </Link>
                </li>
              </ul>
            </div>
          </div>

          {/* Center - Copyright */}
          <div className="col-lg-4 col-md-4 col-sm-12 text-center mb-3 mb-lg-0">
            <div className="footer-meta pt-1">
              <div>{year} Apollo Protocol Activity Diagram Editor</div>
              <div>Created by AMRC in collaboration with CIS</div>
              <div>Version: v{pkg.version}</div>
            </div>
          </div>

          {/* Right - All Logos on same row */}
          <div className="col-lg-4 col-md-4 col-sm-12">
            <div className="footer-logos d-flex align-items-start justify-content-center justify-content-lg-end flex-wrap gap-3">
              <Link href="https://www.amrc.co.uk/">
            <picture className="footer-logo-surface">
              <img
                src="Logo_AMRC.png"
                className="rounded footer-logo-image"
                style={{ maxHeight: "45px", width: "auto" }}
                alt="AMRC"
              />
            </picture>
          </Link>

          <picture className="footer-logo-surface">
            <img
              src="Logo_CIS.png"
              className="footer-logo-image"
              style={{ maxHeight: "45px", width: "auto" }}
              alt="CIS"
            />
          </picture>

          <div className="footer-funded-group d-flex align-items-center">
            <span
              className="footer-funded-label me-2"
              style={{ fontSize: "0.85rem" }}
            >
              Funded by
            </span>
            <picture className="footer-logo-surface footer-logo-surface-sm">
              <img
                src="Logo_InnovateUK.png"
                className="rounded footer-logo-image"
                style={{ maxHeight: "30px", width: "auto" }}
                alt="Innovate UK"
              />
            </picture>
          </div>
        </div>
      </div>
      </div>
      </div>
    </footer>
  );
}
export default Footer;
