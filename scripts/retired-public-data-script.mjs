/**
 * Fail closed for historical scripts that wrote procedure data into public
 * static assets. The authenticated intelligence feed is the only supported
 * source for implants, outcomes, problem cases, contacts and patient links.
 */
export function refusePublicDataMutation(scriptName) {
    const error = new Error(
        `${scriptName} is retired: public assets must never embed procedure records, ` +
        'patient or professional names, comments, identifiers, or device serials. ' +
        'Update the authenticated Procedures feed instead.'
    );
    error.code = 'PUBLIC_DATA_MUTATION_DISABLED';
    throw error;
}
