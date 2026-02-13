import Link from "next/link";
import pkg from "../package.json";

function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer
      className="app-footer"
      style={{
        backgroundColor: "rgba(255, 255, 255, 0.98)",
        backdropFilter: "blur(10px)",
        boxShadow: "0 2px 8px rgba(0, 0, 0, 0.08)",
        padding: "1.5rem 0",
        flexShrink: 0,
      }}
    >
      <div className="container-fluid px-4">
        <div className="row">
          {/* Left - Links */}
          <div className="col-lg-3 col-md-3 col-sm-12 mb-3 mb-lg-0 text-center text-md-start">
            <div className="footer-links">
              <h6 className="footer-links-title text-dark mb-2">More</h6>
              <ul className="footer-links-list list-unstyled mb-0">
                <li className="footer-links-item mb-1">
                <Link
                  className="text-muted text-decoration-none"
                  href="https://digitaltwinhub.co.uk/networks/29-the-apollo-protocol"
                >
                  Get in touch
                </Link>
                </li>
                <li className="footer-links-item">
                <Link
                  className="text-muted text-decoration-none"
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
            <div className="text-muted pt-1">
              <div>{year} Apollo Protocol Activity Diagram Editor</div>
              <div>Created by AMRC in collaboration with CIS</div>
              <div>Version: v{pkg.version}</div>
            </div>
          </div>

          {/* Right - All Logos on same row */}
          <div className="col-lg-5 col-md-5 col-sm-12">
            <div className="footer-logos d-flex align-items-start justify-content-center justify-content-lg-end flex-wrap gap-3">
              <Link href="https://www.amrc.co.uk/">
            <picture>
              <img
                src="Logo_AMRC.png"
                className="rounded"
                style={{ maxHeight: "45px", width: "auto" }}
                alt="AMRC"
              />
            </picture>
          </Link>

          <picture>
            <img
              src="Logo_CIS.png"
              style={{ maxHeight: "45px", width: "auto" }}
              alt="CIS"
            />
          </picture>

          <div className="d-flex align-items-center">
            <span
              className="text-muted me-2"
              style={{ fontSize: "0.85rem" }}
            >
              Funded by
            </span>
            <picture>
              <img
                src="Logo_InnovateUK.png"
                className="rounded"
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
