import Link from "next/link";
import pkg from "../package.json";

function Footer() {
  const style = {};
  const year = new Date().getFullYear();

  return (
    <>
      <div className="container">
        <footer className="py-3 my-4">
          <p className="border-bottom pb-3 mb-3"></p>

          <div className="container">
            <div className="row">
              <div className="col-sm">
                <h5>More</h5>
                <ul className="list-unstyled text-small">
                  <li>
                    <Link
                      className="text-muted"
                      href="https://digitaltwinhub.co.uk/networks/29-the-apollo-protocol"
                    >
                      Get in touch
                    </Link>
                  </li>
                  <li>
                    <Link
                      className="text-muted"
                      href="https://github.com/Apollo-Protocol/4d-activity-editor/discussions"
                    >
                      Give feedback
                    </Link>
                  </li>
                </ul>
              </div>
              <div className="col-sm">
                <div className="text-center text-muted">
                  <div>{year} Apollo Protocol Activity Diagram Editor</div>
                  <div>Created by AMRC in collaboration with CIS</div>
                  <div>Version: v{pkg.version}</div>
                </div>
              </div>
              <div className="col-sm">
                <div className="row mb-3">
                  <div className="col-sm text-center align-self-center">
                    <Link href="https://www.amrc.co.uk/">
                      <picture>
                        <img
                          src="Logo_AMRC.png"
                          className="rounded mw-100"
                          alt="..."
                        ></img>
                      </picture>
                    </Link>
                  </div>
                  <div className="col-5">
                    <picture>
                      <img
                        src="Logo_CIS.png"
                        className="mw-100 float-right"
                        alt="..."
                      ></img>
                    </picture>
                  </div>
                </div>

                <div className="row">
                  <div className="col-sm text-center align-self-center">
                    Funded by{" "}
                    <picture>
                      <img
                        src="Logo_InnovateUK.png"
                        className="rounded w-25"
                        alt="..."
                      ></img>
                    </picture>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
}
export default Footer;
