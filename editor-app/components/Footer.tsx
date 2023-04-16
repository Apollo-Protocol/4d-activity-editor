import Link from "next/link";

function Footer() {
  const style = {};
  return (
    <>
      <div className="container">
      <footer className="py-3 my-4">
        <p className="border-bottom pb-3 mb-3">
        </p>

        <div className="container">
  <div className="row">
    <div className="col-sm">
    <h5>More</h5>
          <ul className="list-unstyled text-small">
            <li><Link className="text-muted" href="https://digitaltwinhub.co.uk/networks/29-the-apollo-protocol">Get in touch</Link></li>
            <li><Link className="text-muted" href="https://github.com/Apollo-Protocol/4d-activity-editor/discussions">Give feedback</Link></li>
          </ul>
    
    </div>
    <div className="col-sm">
    <p className="text-center text-muted"><p className="text-center text-muted">2023 Apollo Protocol Activity Diagram Editor</p> <p className="text-center text-muted">Created by AMRC in collaboration with CIS</p>
    <p className="text-center text-muted"> </p></p>
    </div>
    <div className="col-sm">
      
    <div className="row mb-3">
    <div className="col-sm text-center align-self-center">
    <Link href="https://www.amrc.co.uk/">
    <picture><img src="Logo_AMRC.png" className="rounded mw-100" alt="..."></img></picture>  
    </Link>
    
    </div>
    <div className="col-5">
    <picture><img src="Logo_CIS.png" className="mw-100 float-right" alt="..."></img></picture>
    </div>
    
  </div>

  <div className="row">
    <div className="col-sm text-center align-self-center">
    Funded by <picture><img src="Logo_InnovateUK.png" className="rounded w-25" alt="..."></img></picture>
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
