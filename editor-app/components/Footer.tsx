// filepath: c:\Users\me1meg\Documents\4d-activity-editor\editor-app\components\Footer.tsx
import Link from "next/link";
import pkg from "../package.json";

function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer
      style={{
        backgroundColor: "rgba(255, 255, 255, 0.98)",
        backdropFilter: "blur(10px)",
        boxShadow: "0 -2px 8px rgba(0, 0, 0, 0.08)",
        padding: "1.5rem 0",
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 1020,
      }}
    >
      <div className="container-fluid px-4">
        <div className="row">
          {/* Left - Links */}
          <div className="col-lg-3 col-md-4 col-sm-12 mb-3 mb-lg-0">
            <h6 className="text-dark mb-2">More</h6>
            <ul className="list-unstyled mb-0">
              <li className="mb-1">
                <Link
                  className="text-muted text-decoration-none"
                  href="https://digitaltwinhub.co.uk/networks/29-the-apollo-protocol"
                >
                  Get in touch
                </Link>
              </li>
              <li>
                <Link
                  className="text-muted text-decoration-none"
                  href="https://github.com/Apollo-Protocol/4d-activity-editor/discussions"
                >
                  Give feedback
                </Link>
              </li>
            </ul>
          </div>

          {/* Center - Copyright */}
          <div className="col-lg-5 col-md-4 col-sm-12 text-center mb-3 mb-lg-0 align-self-center">
            <div className="text-muted">
              <div>{year} Apollo Protocol Activity Diagram Editor</div>
              <div>Created by AMRC in collaboration with CIS</div>
              <div>Version: v{pkg.version}</div>
            </div>
          </div>

          {/* Right - Logos */}
          <div className="col-lg-4 col-md-4 col-sm-12">
            <div className="row mb-2">
              <div className="col-6 text-center align-self-center">
                <Link href="https://www.amrc.co.uk/">
                  <picture>
                    <img
                      src="Logo_AMRC.png"
                      className="rounded"
                      style={{ maxWidth: "100%", maxHeight: "50px" }}
                      alt="AMRC"
                    />
                  </picture>
                </Link>
              </div>
              <div className="col-6 text-center align-self-center">
                <picture>
                  <img
                    src="Logo_CIS.png"
                    style={{ maxWidth: "100%", maxHeight: "50px" }}
                    alt="CIS"
                  />
                </picture>
              </div>
            </div>
            <div className="row">
              <div className="col-12 text-center align-self-center">
                <span className="text-muted me-2">Funded by</span>
                <picture>
                  <img
                    src="Logo_InnovateUK.png"
                    className="rounded"
                    style={{ maxHeight: "30px" }}
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
