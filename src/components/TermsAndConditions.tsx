import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FileText } from "lucide-react";

interface TermsAndConditionsProps {
  trigger?: React.ReactNode;
  onAccept?: () => void;
}

export const TermsAndConditions = ({ trigger, onAccept }: TermsAndConditionsProps) => {
  const defaultTrigger = (
    <Button variant="link" className="text-xs text-muted-foreground underline p-0 h-auto">
      Conditions d'utilisation
    </Button>
  );

  return (
    <Dialog>
      <DialogTrigger asChild>
        {trigger || defaultTrigger}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText size={20} />
            Conditions Générales d'Utilisation
          </DialogTitle>
          <DialogDescription>
            Veuillez lire attentivement les conditions d'utilisation de NACK!
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[60vh] pr-4">
          <div className="space-y-4 text-sm text-muted-foreground">
            <section>
              <h3 className="font-semibold text-foreground mb-2">1. Acceptation des conditions</h3>
              <p>
                En utilisant la plateforme NACK!, vous acceptez sans réserve les présentes conditions générales d'utilisation. 
                Si vous n'acceptez pas ces conditions, veuillez ne pas utiliser nos services.
              </p>
            </section>

            <section>
              <h3 className="font-semibold text-foreground mb-2">2. Utilisation des données</h3>
              <p>
                En vous inscrivant sur NACK!, vous acceptez que vos données puissent être utilisées à des fins d'études de marché 
                et d'analyses statistiques dans le but d'améliorer nos services et de contribuer au bien-être de la population 
                gabonaise. Ces données seront traitées de manière anonyme et agrégée, dans le respect de votre vie privée et 
                conformément à la réglementation en vigueur.
              </p>
            </section>

            <section>
              <h3 className="font-semibold text-foreground mb-2">3. Protection des données personnelles</h3>
              <p>
                Nous nous engageons à protéger vos données personnelles et à les utiliser uniquement dans le cadre de la 
                fourniture de nos services. Vos informations sont stockées de manière sécurisée et ne seront jamais vendues 
                à des tiers sans votre consentement explicite.
              </p>
            </section>

            <section>
              <h3 className="font-semibold text-foreground mb-2">4. Études de marché et amélioration des services</h3>
              <p>
                Les données collectées peuvent être utilisées pour réaliser des études de marché anonymisées visant à :
              </p>
              <ul className="list-disc list-inside ml-4 mt-2 space-y-1">
                <li>Comprendre les besoins des établissements gabonais</li>
                <li>Améliorer nos services et fonctionnalités</li>
                <li>Contribuer à des initiatives pour le bien-être de la population</li>
                <li>Générer des statistiques agrégées sur le secteur de la restauration au Gabon</li>
              </ul>
            </section>

            <section>
              <h3 className="font-semibold text-foreground mb-2">5. Responsabilités</h3>
              <p>
                Vous êtes responsable de la confidentialité de vos identifiants et de toutes les activités qui se déroulent 
                sous votre compte. Vous vous engagez à fournir des informations exactes et à jour.
              </p>
            </section>

            <section>
              <h3 className="font-semibold text-foreground mb-2">6. Propriété intellectuelle</h3>
              <p>
                Tous les contenus de la plateforme NACK! (textes, images, logos, etc.) sont protégés par les droits de 
                propriété intellectuelle. Toute reproduction non autorisée est interdite.
              </p>
            </section>

            <section>
              <h3 className="font-semibold text-foreground mb-2">7. Modification des conditions</h3>
              <p>
                NACK! se réserve le droit de modifier ces conditions à tout moment. Les utilisateurs seront informés des 
                modifications importantes par email ou via la plateforme.
              </p>
            </section>

            <section>
              <h3 className="font-semibold text-foreground mb-2">8. Contact</h3>
              <p>
                Pour toute question concernant ces conditions d'utilisation, vous pouvez nous contacter via WhatsApp 
                au +241 04 74 68 47 ou par email.
              </p>
            </section>

            <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg mt-4">
              <p className="text-xs text-blue-800">
                <strong>Note importante :</strong> En acceptant ces conditions, vous reconnaissez avoir lu, compris et 
                accepté l'utilisation de vos données à des fins d'études de marché et d'amélioration des services, 
                dans le respect de votre vie privée et pour le bien-être de la population gabonaise.
              </p>
            </div>
          </div>
        </ScrollArea>
        {onAccept && (
          <div className="flex justify-end pt-4 border-t">
            <Button onClick={onAccept} className="bg-gradient-primary text-white">
              J'accepte les conditions
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default TermsAndConditions;

