import Configstore from "configstore"
import { createOAuthAppAuth } from "@octokit/auth-oauth-app"
import { GithubOAuthRequest, GithubOAuthResponse } from "cli/types"
import open from "open"
import clipboard from "clipboardy"
import { getAuth, GithubAuthProvider, OAuthCredential, signInWithCredential, UserCredential } from "firebase/auth"
import ora from "ora"
import theme from "./theme.js"
import readJSONFile from "./files.js"

const pkg = readJSONFile("./package.json")
// Local configstore for storing auth data (e.g., tokens).
const conf = new Configstore(pkg.name)
// Customizable spinner.
const spinner = ora({
  text: "Waiting for authorization",
  spinner: "clock"
})

/**
 * Manage the data requested for Github OAuth2.0.
 * @param data <GithubOAuthRequest> - the data from Github OAuth2.0 device flow request.
 */
const onVerification = (data: GithubOAuthRequest): void => {
  // Automatically open the page (# Step 2).
  open(data.verification_uri)

  // Copy code to clipboard.
  clipboard.writeSync(data.user_code)
  clipboard.readSync()

  // Display data.
  console.log(
    theme.monoD(`\nVisit ${theme.bold(theme.underlined(data.verification_uri))} on this device to authenticate`)
  )
  console.log(theme.monoD(`\nYou have to enter this code: ${theme.bold(data.user_code)} (clipboarded!)`))
  console.log(theme.monoD(`Expires in ${theme.yellowD(`${theme.bold(Math.round(data.expires_in / 60))} minutes`)}\n`))

  spinner.start()
}

/**
 * Exchange the Github OAuth 2.0 token for a Firebase credential.
 * @param token <string> - the Github OAuth 2.0 token to be exchanged.
 * @returns <OAuthCredential> - the Firebase OAuth credential object.
 */
const exchangeTokenForCredentials = (token: string): OAuthCredential => GithubAuthProvider.credential(token)

/**
 * Return the Github OAuth 2.0 token, if present.
 * @returns <string | undefined> - the Github OAuth 2.0 token if present, otherwise undefined.
 */
export const getStoredOAuthToken = (): string | undefined => conf.get("oauth.token")

/**
 * Store the Github OAuth 2.0 token.
 * @param token <string> - the Github OAuth 2.0 token to be stored.
 */
export const setStoredOAuthToken = (token: string) => conf.set("oauth.token", token)

/**
 * Delete the stored Github OAuth 2.0 token.
 */
export const deleteStoredOAuthToken = () => conf.delete("oauth.token")

/**
 * Return the Github OAuth 2.0 token stored locally.
 * @returns <Promise<string>> - the Github OAuth 2.0 token.
 */
export const checkForStoredOAuthToken = async (): Promise<string> => {
  // Check if stored locally.
  const ghToken = getStoredOAuthToken()

  if (!ghToken)
    throw new Error(
      "\n You're not authenticated with your Github account. Please, run the `phase2cli login` command first!"
    )

  return ghToken
}

/**
 * Return the Github OAuth 2.0 token using manual Device Flow authentication process.
 * @param clientId <string> - the client id for the CLI OAuth app.
 * @param clientSecret <string> - the client secret for the CLI OAuth app.
 * @returns <string> the Github OAuth 2.0 token.
 */
export const getOAuthToken = async (clientId: string, clientSecret: string): Promise<GithubOAuthResponse> => {
  /**
   * Github OAuth 2.0 Device Flow.
   * # Step 1: Request device and user verification codes and gets auth verification uri.
   * # Step 2: The app prompts the user to enter a user verification code at https://github.com/login/device.
   * # Step 3: The app polls/asks for the user authentication status.
   */

  const clientType = "oauth-app"
  const requestType = "oauth-user"

  // # Step 1.
  const auth = createOAuthAppAuth({
    clientType,
    clientId,
    clientSecret
  })

  // # Step 3.
  const ghToken = await auth({
    type: requestType,
    onVerification // # Step 2.
  })

  spinner.stop()

  return ghToken
}

/**
 * Sign in w/ OAuth 2.0 token.
 * @param token <string> - the Github OAuth 2.0 token to be exchanged.
 * @returns <Promise<UserCredential>>
 */
export const signIn = async (token: string): Promise<UserCredential> => {
  // Sign in with the credential.
  const auth = getAuth()
  const credential = exchangeTokenForCredentials(token)

  return signInWithCredential(auth, credential)
}