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
            <li><Link className="text-muted" href="#">Get in touch</Link></li>
          </ul>
    
    </div>
    <div className="col-sm">
    <p className="text-center text-muted"><p className="text-center text-muted">2023 Apollo Protocol Activity Diagram Editor</p> <p className="text-center text-muted">Created by AMRC in collaboration with CIS</p></p>
    </div>
    <div className="col-sm">
    <Link href="https://www.amrc.co.uk/">
    <picture><img src="Logo_AMRC.png" className="rounded w-50" alt="..."></img></picture>
    </Link>
    <p></p>
    <picture><img src="Logo_CIS.png" className="float-right w-50 " alt="..."></img></picture>
    </div>
  </div>
</div>
        
      </footer>
    </div>
    </>
  );
}
export default Footer;
