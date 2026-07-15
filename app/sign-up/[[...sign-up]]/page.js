import { SignUp } from '@clerk/nextjs';

   export default function SignUpPage() {
     return (
       <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', gap: '24px' }}>
         <img src="/chew-logo.png" alt="CHEW" style={{ height: '64px', width: 'auto' }} />
         <SignUp
           appearance={{
             variables: {
               colorPrimary: '#C8A63C',
               colorBackground: '#131311',
               colorText: '#F5F3EE',
             },
           }}
         />
       </div>
     );
   }
