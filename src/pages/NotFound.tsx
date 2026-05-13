import { useLocation } from "react-router-dom";
import { useEffect } from "react";
import { Helmet } from "react-helmet-async";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted">
      <Helmet>
        <title>Sidan hittades inte – Grim</title>
        <meta name="description" content="Sidan du letade efter finns inte. Återvänd till Grim för att fortsätta spåra din träning." />
        <meta name="robots" content="noindex" />
        <link rel="canonical" href="https://grim.lovable.app/" />
      </Helmet>
      <div className="text-center">
        <h1 className="mb-4 text-4xl font-bold">404 – Sidan hittades inte</h1>
        <p className="mb-4 text-xl text-muted-foreground">Oops! Page not found</p>
        <a href="/" className="text-primary underline hover:text-primary/90">
          Return to Home
        </a>
      </div>
    </div>
  );
};

export default NotFound;
